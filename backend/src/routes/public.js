const express = require("express");
const db = require("../db");
const { videoUpload, imageUpload, unlinkUpload } = require("../upload");
const { makeThumbnail } = require("../thumbnails");
const { requireUser, optionalUser } = require("../middleware/auth");

const router = express.Router();

router.get("/games", async (_req, res) => {
  const games = await db.getGames();
  res.json({
    games,
    dbReady: db.isReady(),
    dbError: db.getLastError(),
  });
});

router.get("/games/:slug/videos", optionalUser, async (req, res) => {
  const game = await db.getGameBySlug(req.params.slug);
  if (!game) {
    return res.status(404).json({ message: "未找到该游戏。" });
  }
  const userId = req.user?.id || 0;
  const paging = { page: req.query.page, pageSize: req.query.pageSize };
  const result = await db.listVideos(game.id, userId, paging);
  res.json({ game, ...result });
});

router.get("/games/:slug/screenshots", optionalUser, async (req, res) => {
  const game = await db.getGameBySlug(req.params.slug);
  if (!game) {
    return res.status(404).json({ message: "未找到该游戏。" });
  }
  const userId = req.user?.id || 0;
  const paging = { page: req.query.page, pageSize: req.query.pageSize };
  const result = await db.listScreenshots(game.id, userId, paging);
  res.json({ game, ...result });
});

router.get("/games/:slug/:kind/:id", optionalUser, async (req, res) => {
  if (!db.isReady()) {
    return res.status(503).json({ message: db.getLastError() || "数据库未连接。" });
  }
  const kind = req.params.kind === "videos" ? "video" : req.params.kind === "screenshots" ? "screenshot" : "";
  const mediaId = Number(req.params.id);
  if (!kind || !Number.isInteger(mediaId) || mediaId <= 0) {
    return res.status(404).json({ message: "内容不存在。" });
  }
  const item = await db.getPublicMedia(kind, mediaId, req.user?.id || 0);
  if (!item || item.game_slug !== req.params.slug) {
    return res.status(404).json({ message: "内容不存在。" });
  }
  res.json({
    game: { id: item.game_id, slug: item.game_slug, name: item.game_name },
    item,
    kind,
  });
});

router.post("/likes/toggle", requireUser, async (req, res) => {
  if (!db.isReady()) {
    return res.status(503).json({ message: db.getLastError() || "数据库未连接。" });
  }

  const mediaType = String(req.body.type || "");
  const mediaId = Number(req.body.id);
  if (!["video", "screenshot"].includes(mediaType) || !Number.isInteger(mediaId) || mediaId <= 0) {
    return res.status(400).json({ message: "点赞参数无效。" });
  }

  const exists = await db.mediaExists(mediaType, mediaId);
  if (!exists) {
    return res.status(404).json({ message: "内容不存在。" });
  }

  const result = await db.toggleLike(mediaType, mediaId, req.user.id);
  res.json(result);
});

function parseSubmitFields(body, user) {
  return {
    title: String(body.title || "").trim(),
    gameId: Number(body.game_id),
    description: String(body.description || "").trim() || null,
    submitterName: String(body.submitter_name || "").trim().slice(0, 40) || user.nickname || "用户",
  };
}

router.post("/submissions/videos", requireUser, (req, res) => {
  if (!db.isReady()) {
    return res.status(503).json({ message: db.getLastError() || "数据库未连接。" });
  }
  videoUpload.single("file")(req, res, async (err) => {
    if (err) return res.status(400).json({ message: err.message });
    if (!req.file) return res.status(400).json({ message: "请选择要投稿的视频。" });

    const fields = parseSubmitFields(req.body, req.user);
    if (!fields.title || !fields.gameId) {
      unlinkUpload(`/uploads/videos/${req.file.filename}`);
      return res.status(400).json({ message: "请填写标题并选择游戏。" });
    }
    const game = await db.getGameById(fields.gameId);
    if (!game) {
      unlinkUpload(`/uploads/videos/${req.file.filename}`);
      return res.status(400).json({ message: "游戏不存在。" });
    }

    const id = await db.insertVideo({
      gameId: fields.gameId,
      title: fields.title,
      description: fields.description,
      filePath: `/uploads/videos/${req.file.filename}`,
      originalFilename: req.file.originalname,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      createdBy: null,
      submitterName: fields.submitterName,
      reviewStatus: "pending",
    });
    res.json({ id, message: "投稿已提交，等待管理员审核。" });
  });
});

router.post("/submissions/screenshots", requireUser, (req, res) => {
  if (!db.isReady()) {
    return res.status(503).json({ message: db.getLastError() || "数据库未连接。" });
  }
  imageUpload.single("file")(req, res, async (err) => {
    if (err) return res.status(400).json({ message: err.message });
    if (!req.file) return res.status(400).json({ message: "请选择要投稿的图片。" });

    const fields = parseSubmitFields(req.body, req.user);
    if (!fields.title || !fields.gameId) {
      unlinkUpload(`/uploads/screenshots/${req.file.filename}`);
      return res.status(400).json({ message: "请填写标题并选择游戏。" });
    }
    const game = await db.getGameById(fields.gameId);
    if (!game) {
      unlinkUpload(`/uploads/screenshots/${req.file.filename}`);
      return res.status(400).json({ message: "游戏不存在。" });
    }

    const filePath = `/uploads/screenshots/${req.file.filename}`;
    const thumbnailPath = await makeThumbnail(filePath);
    const id = await db.insertScreenshot({
      gameId: fields.gameId,
      title: fields.title,
      description: fields.description,
      filePath,
      thumbnailPath,
      originalFilename: req.file.originalname,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      createdBy: null,
      submitterName: fields.submitterName,
      reviewStatus: "pending",
    });
    res.json({ id, message: "投稿已提交，等待管理员审核。" });
  });
});

router.get("/comments", optionalUser, async (req, res) => {
  if (!db.isReady()) {
    return res.status(503).json({ message: db.getLastError() || "数据库未连接。" });
  }
  const mediaType = String(req.query.type || "");
  const mediaId = Number(req.query.id);
  if (!["video", "screenshot"].includes(mediaType) || !Number.isInteger(mediaId) || mediaId <= 0) {
    return res.status(400).json({ message: "评论参数无效。" });
  }
  const exists = await db.mediaExists(mediaType, mediaId);
  if (!exists) {
    return res.status(404).json({ message: "内容不存在。" });
  }
  const comments = await db.listComments(mediaType, mediaId, req.user?.id || 0);
  res.json({ comments });
});

router.post("/comments", requireUser, async (req, res) => {
  if (!db.isReady()) {
    return res.status(503).json({ message: db.getLastError() || "数据库未连接。" });
  }
  const mediaType = String(req.body.type || "");
  const mediaId = Number(req.body.id);
  const content = String(req.body.content || "").trim();
  const parentId = req.body.parent_id ? Number(req.body.parent_id) : null;
  if (!["video", "screenshot"].includes(mediaType) || !Number.isInteger(mediaId) || mediaId <= 0) {
    return res.status(400).json({ message: "评论参数无效。" });
  }
  if (!content) {
    return res.status(400).json({ message: "请输入评论内容。" });
  }
  if (content.length > 500) {
    return res.status(400).json({ message: "评论不能超过 500 字。" });
  }
  if (parentId != null && (!Number.isInteger(parentId) || parentId <= 0)) {
    return res.status(400).json({ message: "回复目标无效。" });
  }
  const exists = await db.mediaExists(mediaType, mediaId);
  if (!exists) {
    return res.status(404).json({ message: "内容不存在。" });
  }
  try {
    const comment = await db.insertComment({
      mediaType,
      mediaId,
      userId: req.user.id,
      parentId,
      content,
    });
    res.json({ comment });
  } catch (err) {
    if (err.status === 400) {
      return res.status(400).json({ message: err.message });
    }
    throw err;
  }
});

router.post("/comments/:id/like", requireUser, async (req, res) => {
  if (!db.isReady()) {
    return res.status(503).json({ message: db.getLastError() || "数据库未连接。" });
  }
  const commentId = Number(req.params.id);
  if (!Number.isInteger(commentId) || commentId <= 0) {
    return res.status(400).json({ message: "评论不存在。" });
  }
  const result = await db.toggleCommentLike(commentId, req.user.id);
  if (!result) {
    return res.status(404).json({ message: "评论不存在。" });
  }
  res.json(result);
});

module.exports = router;
