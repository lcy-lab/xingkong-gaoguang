const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");
const { requireAdmin, requireDb } = require("../middleware/auth");
const { makeThumbnail } = require("../thumbnails");
const { videoUpload, imageUpload, unlinkUpload } = require("../upload");

const router = express.Router();

function signAdmin(admin) {
  return jwt.sign(
    { id: admin.id, username: admin.username, displayName: admin.display_name, role: "admin" },
    process.env.JWT_SECRET || "game-portal-dev-secret",
    { expiresIn: "8h" }
  );
}

router.post("/auth/login", async (req, res) => {
  if (!db.isReady()) {
    return res.status(503).json({
      message: db.getLastError() || "数据库未连接。",
    });
  }

  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");
  const admin = await db.findAdminByUsername(username);
  if (!admin || admin.status !== "active") {
    return res.status(401).json({ message: "账号或密码错误。" });
  }

  const match = await bcrypt.compare(password, admin.password_hash);
  if (!match) {
    return res.status(401).json({ message: "账号或密码错误。" });
  }

  const payload = {
    id: admin.id,
    username: admin.username,
    displayName: admin.display_name,
    role: "admin",
  };
  res.json({ token: signAdmin(admin), admin: payload });
});

router.get("/auth/me", requireAdmin, (req, res) => {
  res.json({ admin: req.admin });
});

router.get("/admin/dashboard", requireAdmin, requireDb, async (_req, res) => {
  const games = await db.getGames();
  const videos = await db.listAllVideos("approved");
  const screenshots = await db.listAllScreenshots("approved");
  const pendingVideos = await db.listAllVideos("pending");
  const pendingScreenshots = await db.listAllScreenshots("pending");
  res.json({ games, videos, screenshots, pendingVideos, pendingScreenshots });
});

router.post("/admin/videos", requireAdmin, requireDb, (req, res) => {
  videoUpload.single("file")(req, res, async (err) => {
    if (err) return res.status(400).json({ message: err.message });
    if (!req.file) return res.status(400).json({ message: "请选择要上传的视频文件。" });

    const title = String(req.body.title || "").trim();
    const gameId = Number(req.body.game_id);
    if (!title || !gameId) {
      unlinkUpload(`/uploads/videos/${req.file.filename}`);
      return res.status(400).json({ message: "请填写标题并选择游戏。" });
    }

    const id = await db.insertVideo({
      gameId,
      title,
      description: String(req.body.description || "").trim() || null,
      filePath: `/uploads/videos/${req.file.filename}`,
      originalFilename: req.file.originalname,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      createdBy: req.admin.id,
      reviewStatus: "approved",
    });

    res.json({ id, message: "视频已添加。" });
  });
});

router.post("/admin/screenshots", requireAdmin, requireDb, (req, res) => {
  imageUpload.single("file")(req, res, async (err) => {
    if (err) return res.status(400).json({ message: err.message });
    if (!req.file) return res.status(400).json({ message: "请选择要上传的截图。" });

    const title = String(req.body.title || "").trim();
    const gameId = Number(req.body.game_id);
    if (!title || !gameId) {
      unlinkUpload(`/uploads/screenshots/${req.file.filename}`);
      return res.status(400).json({ message: "请填写标题并选择游戏。" });
    }

    const filePath = `/uploads/screenshots/${req.file.filename}`;
    const thumbnailPath = await makeThumbnail(filePath);

    const id = await db.insertScreenshot({
      gameId,
      title,
      description: String(req.body.description || "").trim() || null,
      filePath,
      thumbnailPath,
      originalFilename: req.file.originalname,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      createdBy: req.admin.id,
      reviewStatus: "approved",
    });

    res.json({ id, message: "截图已添加。" });
  });
});

router.delete("/admin/videos/:id", requireAdmin, requireDb, async (req, res) => {
  const row = await db.getVideoById(req.params.id);
  if (row) {
    unlinkUpload(row.file_path);
    await db.deleteVideo(row.id);
  }
  res.json({ message: "视频已删除。" });
});

router.delete("/admin/screenshots/:id", requireAdmin, requireDb, async (req, res) => {
  const row = await db.getScreenshotById(req.params.id);
  if (row) {
    unlinkUpload(row.file_path);
    unlinkUpload(row.thumbnail_path);
    await db.deleteScreenshot(row.id);
  }
  res.json({ message: "截图已删除。" });
});

router.post("/admin/videos/:id/review", requireAdmin, requireDb, async (req, res) => {
  const action = String(req.body.action || "");
  if (!["approve", "reject"].includes(action)) {
    return res.status(400).json({ message: "审核操作无效。" });
  }
  const ok = await db.setReviewStatus("video", req.params.id, action === "approve" ? "approved" : "rejected");
  if (!ok) return res.status(404).json({ message: "视频不存在。" });
  res.json({ message: action === "approve" ? "已通过，视频将在前台展示。" : "已拒绝该投稿。" });
});

router.post("/admin/screenshots/:id/review", requireAdmin, requireDb, async (req, res) => {
  const action = String(req.body.action || "");
  if (!["approve", "reject"].includes(action)) {
    return res.status(400).json({ message: "审核操作无效。" });
  }
  const ok = await db.setReviewStatus("screenshot", req.params.id, action === "approve" ? "approved" : "rejected");
  if (!ok) return res.status(404).json({ message: "截图不存在。" });
  res.json({ message: action === "approve" ? "已通过，截图将在前台展示。" : "已拒绝该投稿。" });
});

module.exports = router;
