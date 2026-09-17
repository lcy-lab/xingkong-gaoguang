const jwt = require("jsonwebtoken");
const db = require("../db");

function readToken(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET || "game-portal-dev-secret");
  } catch {
    return null;
  }
}

function requireAdmin(req, res, next) {
  const payload = readToken(req);
  if (!payload || payload.role === "user" || !payload.username) {
    return res.status(401).json({ message: "请先登录管理员账号。" });
  }
  req.admin = payload;
  next();
}

function requireUser(req, res, next) {
  const payload = readToken(req);
  if (!payload || payload.role !== "user") {
    return res.status(401).json({ message: "请先登录后再操作。" });
  }
  req.user = payload;
  next();
}

function optionalUser(req, res, next) {
  const payload = readToken(req);
  if (payload && payload.role === "user") {
    req.user = payload;
  }
  next();
}

function requireDb(req, res, next) {
  if (!db.isReady()) {
    return res.status(503).json({
      message: db.getLastError() || "数据库未连接，请检查 backend/.env 中的 DB_PASSWORD 后重启后端。",
    });
  }
  next();
}

module.exports = { requireAdmin, requireUser, optionalUser, requireDb };
