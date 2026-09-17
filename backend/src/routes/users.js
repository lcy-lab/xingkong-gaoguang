const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const db = require("../db");
const { sendSms } = require("../sms");
const { requireUser, requireDb } = require("../middleware/auth");

const router = express.Router();
const PHONE_RE = /^1\d{10}$/;

function signUser(user) {
  return jwt.sign(
    { id: user.id, phone: user.phone, nickname: user.nickname, role: "user" },
    process.env.JWT_SECRET || "game-portal-dev-secret",
    { expiresIn: "30d" }
  );
}

function publicUser(user) {
  return { id: user.id, phone: user.phone, nickname: user.nickname };
}

router.post("/users/sms", requireDb, async (req, res) => {
  const phone = String(req.body.phone || "").trim();
  const scene = String(req.body.scene || "register");
  if (!PHONE_RE.test(phone)) {
    return res.status(400).json({ message: "请输入正确的11位手机号。" });
  }
  if (scene !== "register") {
    return res.status(400).json({ message: "验证码场景无效。" });
  }

  const existing = await db.findUserByPhone(phone);
  if (existing) {
    return res.status(409).json({ message: "该手机号已注册，请直接登录。" });
  }

  const latest = await db.getLatestSms(phone);
  if (latest && Date.now() - new Date(latest.created_at).getTime() < 60_000) {
    return res.status(429).json({ message: "验证码发送过于频繁，请稍后再试。" });
  }

  const code = String(crypto.randomInt(100000, 1000000));
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  try {
    await sendSms(phone, code);
  } catch (err) {
    return res.status(500).json({ message: err.message || "短信发送失败。" });
  }
  await db.insertSmsCode({ phone, code, scene, expiresAt });
  const payload = { message: "验证码已发送。" };
  if (process.env.SMS_DEV === "1" || process.env.SMS_DEV === "true") {
    payload.devHint = "开发模式：验证码已打印在后端控制台。";
  }
  res.json(payload);
});

router.post("/users/register", requireDb, async (req, res) => {
  const phone = String(req.body.phone || "").trim();
  const code = String(req.body.code || "").trim();
  const nickname = String(req.body.nickname || "").trim().slice(0, 40);
  const password = String(req.body.password || "");

  if (!PHONE_RE.test(phone)) {
    return res.status(400).json({ message: "请输入正确的11位手机号。" });
  }
  if (!/^\d{6}$/.test(code)) {
    return res.status(400).json({ message: "请输入6位短信验证码。" });
  }
  if (!nickname) {
    return res.status(400).json({ message: "请填写昵称。" });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: "密码至少 6 位。" });
  }

  const exists = await db.findUserByPhone(phone);
  if (exists) {
    return res.status(409).json({ message: "该手机号已注册，请直接登录。" });
  }

  const ok = await db.consumeSmsCode(phone, code, "register");
  if (!ok) {
    return res.status(400).json({ message: "验证码错误或已过期。" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const id = await db.createUser({ phone, passwordHash, nickname });
  const user = { id, phone, nickname };
  res.json({ token: signUser(user), user: publicUser(user) });
});

router.post("/users/login", requireDb, async (req, res) => {
  const phone = String(req.body.phone || "").trim();
  const password = String(req.body.password || "");
  if (!PHONE_RE.test(phone) || !password) {
    return res.status(400).json({ message: "请输入手机号和密码。" });
  }

  const user = await db.findUserByPhone(phone);
  if (!user) {
    return res.status(401).json({ message: "手机号或密码错误。" });
  }
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    return res.status(401).json({ message: "手机号或密码错误。" });
  }

  const payload = publicUser(user);
  res.json({ token: signUser(user), user: payload });
});

router.get("/users/me", requireUser, requireDb, async (req, res) => {
  const user = await db.findUserById(req.user.id);
  if (!user) {
    return res.status(401).json({ message: "账号不存在，请重新登录。" });
  }
  res.json({ user: publicUser(user) });
});

module.exports = router;
