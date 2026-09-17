const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const { makeThumbnail } = require("./thumbnails");

const FALLBACK_GAMES = [
  { id: 1, slug: "lol", name: "英雄联盟", sort_order: 1 },
  { id: 2, slug: "valorant", name: "无畏契约", sort_order: 2 },
  { id: 3, slug: "qqspeed", name: "QQ飞车", sort_order: 3 },
  { id: 4, slug: "hok", name: "王者荣耀", sort_order: 4 },
  { id: 5, slug: "tft", name: "金铲铲之战", sort_order: 5 },
];

let pool = null;
let dbReady = false;
let lastError = null;

function config() {
  return {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "game_portal",
    charset: "utf8mb4",
  };
}

async function initDb() {
  const cfg = config();
  const schemaPath = path.join(__dirname, "..", "sql", "schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf8");

  const bootstrap = await mysql.createConnection({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    multipleStatements: true,
    connectTimeout: 5000,
  });

  await bootstrap.query(schemaSql);
  await bootstrap.end();

  pool = mysql.createPool({
    ...cfg,
    waitForConnections: true,
    connectionLimit: 10,
    connectTimeout: 5000,
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS media_likes (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      media_type ENUM('video', 'screenshot') NOT NULL,
      media_id BIGINT UNSIGNED NOT NULL,
      visitor_id VARCHAR(64) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_like_once (visitor_id, media_type, media_id),
      KEY idx_likes_media (media_type, media_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const [thumbCol] = await pool.query(
    "SHOW COLUMNS FROM highlight_screenshots LIKE 'thumbnail_path'"
  );
  if (!thumbCol.length) {
    await pool.query(
      "ALTER TABLE highlight_screenshots ADD COLUMN thumbnail_path VARCHAR(500) NULL"
    );
  }

  async function ensureColumn(table, column, ddl) {
    const [cols] = await pool.query(`SHOW COLUMNS FROM ${table} LIKE ?`, [column]);
    if (!cols.length) {
      await pool.query(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
    }
  }

  await ensureColumn(
    "highlight_videos",
    "review_status",
    "review_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'approved'"
  );
  await ensureColumn("highlight_videos", "submitter_name", "submitter_name VARCHAR(40) NULL");
  await ensureColumn(
    "highlight_screenshots",
    "review_status",
    "review_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'approved'"
  );
  await ensureColumn("highlight_screenshots", "submitter_name", "submitter_name VARCHAR(40) NULL");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      phone VARCHAR(11) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      nickname VARCHAR(40) NOT NULL DEFAULT '',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_users_phone (phone)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sms_codes (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      phone VARCHAR(11) NOT NULL,
      code VARCHAR(6) NOT NULL,
      scene VARCHAR(20) NOT NULL DEFAULT 'register',
      expires_at DATETIME NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_sms_phone_created (phone, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await ensureColumn("media_likes", "user_id", "user_id BIGINT UNSIGNED NULL");
  const [likeIndex] = await pool.query("SHOW INDEX FROM media_likes WHERE Key_name = 'uk_like_once'");
  if (likeIndex.length) {
    await pool.query("ALTER TABLE media_likes DROP INDEX uk_like_once");
  }
  const [userLikeIndex] = await pool.query(
    "SHOW INDEX FROM media_likes WHERE Key_name = 'uk_user_like'"
  );
  if (!userLikeIndex.length) {
    await pool.query(
      "ALTER TABLE media_likes ADD UNIQUE KEY uk_user_like (user_id, media_type, media_id)"
    );
  }

  const [gameRows] = await pool.query("SELECT COUNT(*) AS n FROM games");
  if (gameRows[0].n === 0) {
    await pool.query(
      `INSERT INTO games (slug, name, sort_order, is_enabled) VALUES
        ('lol', '英雄联盟', 1, 1),
        ('valorant', '无畏契约', 2, 1),
        ('qqspeed', 'QQ飞车', 3, 1),
        ('hok', '王者荣耀', 4, 1),
        ('tft', '金铲铲之战', 5, 1)`
    );
  }

  const [adminRows] = await pool.query("SELECT COUNT(*) AS n FROM admins");
  if (adminRows[0].n === 0) {
    const username = process.env.ADMIN_USERNAME || "admin";
    const password = process.env.ADMIN_PASSWORD || "admin123";
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      "INSERT INTO admins (username, password_hash, display_name, status) VALUES (?, ?, ?, 'active')",
      [username, hash, "管理员"]
    );
  }

  dbReady = true;
  lastError = null;
}

async function getGames() {
  if (!dbReady) return FALLBACK_GAMES;
  const [rows] = await pool.query(
    "SELECT id, slug, name, sort_order FROM games WHERE is_enabled = 1 ORDER BY sort_order ASC, id ASC"
  );
  return rows;
}

async function getGameById(id) {
  const [rows] = await pool.query(
    "SELECT id, slug, name FROM games WHERE id = ? AND is_enabled = 1 LIMIT 1",
    [id]
  );
  return rows[0] || null;
}

async function getGameBySlug(slug) {
  if (!dbReady) {
    return FALLBACK_GAMES.find((g) => g.slug === slug) || null;
  }
  const [rows] = await pool.query(
    "SELECT id, slug, name FROM games WHERE slug = ? AND is_enabled = 1 LIMIT 1",
    [slug]
  );
  return rows[0] || null;
}

function mapLikeRows(rows) {
  return rows.map((row) => ({
    ...row,
    like_count: Number(row.like_count || 0),
    liked: Boolean(row.liked),
  }));
}

function parsePaging(page, pageSize, fallbackSize) {
  const size = Math.min(24, Math.max(1, Number(pageSize) || fallbackSize));
  const current = Math.max(1, Number(page) || 1);
  return { page: current, pageSize: size, offset: (current - 1) * size };
}

async function listVideos(gameId, userId = 0, paging = {}) {
  if (!dbReady) return { items: [], total: 0, page: 1, pageSize: 8 };
  const { page, pageSize, offset } = parsePaging(paging.page, paging.pageSize, 8);
  const [[countRow]] = await pool.query(
    "SELECT COUNT(*) AS n FROM highlight_videos WHERE game_id = ? AND review_status = 'approved'",
    [gameId]
  );
  const [rows] = await pool.query(
    `SELECT v.id, v.title, v.description, v.file_path, v.created_at,
      (SELECT COUNT(*) FROM media_likes l WHERE l.media_type = 'video' AND l.media_id = v.id) AS like_count,
      EXISTS(
        SELECT 1 FROM media_likes l
        WHERE l.media_type = 'video' AND l.media_id = v.id AND l.user_id = ?
      ) AS liked
     FROM highlight_videos v
     WHERE v.game_id = ? AND v.review_status = 'approved'
     ORDER BY v.created_at DESC
     LIMIT ? OFFSET ?`,
    [userId || 0, gameId, pageSize, offset]
  );
  return {
    items: mapLikeRows(rows),
    total: Number(countRow.n),
    page,
    pageSize,
  };
}

async function listScreenshots(gameId, userId = 0, paging = {}) {
  if (!dbReady) return { items: [], total: 0, page: 1, pageSize: 12 };
  const { page, pageSize, offset } = parsePaging(paging.page, paging.pageSize, 12);
  const [[countRow]] = await pool.query(
    "SELECT COUNT(*) AS n FROM highlight_screenshots WHERE game_id = ? AND review_status = 'approved'",
    [gameId]
  );
  const [rows] = await pool.query(
    `SELECT s.id, s.title, s.description, s.file_path, s.thumbnail_path, s.created_at,
      (SELECT COUNT(*) FROM media_likes l WHERE l.media_type = 'screenshot' AND l.media_id = s.id) AS like_count,
      EXISTS(
        SELECT 1 FROM media_likes l
        WHERE l.media_type = 'screenshot' AND l.media_id = s.id AND l.user_id = ?
      ) AS liked
     FROM highlight_screenshots s
     WHERE s.game_id = ? AND s.review_status = 'approved'
     ORDER BY s.created_at DESC
     LIMIT ? OFFSET ?`,
    [userId || 0, gameId, pageSize, offset]
  );

  const items = mapLikeRows(rows);
  for (const item of items) {
    if (!item.thumbnail_path) {
      const thumb = await makeThumbnail(item.file_path);
      if (thumb) {
        await pool.query("UPDATE highlight_screenshots SET thumbnail_path = ? WHERE id = ?", [
          thumb,
          item.id,
        ]);
        item.thumbnail_path = thumb;
      } else {
        item.thumbnail_path = item.file_path;
      }
    }
  }

  return {
    items,
    total: Number(countRow.n),
    page,
    pageSize,
  };
}

async function listAllVideos(reviewStatus = "approved") {
  const [rows] = await pool.query(
    `SELECT v.id, v.title, v.description, v.file_path, v.submitter_name, v.created_at,
            g.name AS game_name, g.slug AS game_slug
     FROM highlight_videos v
     JOIN games g ON g.id = v.game_id
     WHERE v.review_status = ?
     ORDER BY v.created_at DESC`,
    [reviewStatus]
  );
  return rows;
}

async function listAllScreenshots(reviewStatus = "approved") {
  const [rows] = await pool.query(
    `SELECT s.id, s.title, s.description, s.file_path, s.thumbnail_path, s.submitter_name, s.created_at,
            g.name AS game_name, g.slug AS game_slug
     FROM highlight_screenshots s
     JOIN games g ON g.id = s.game_id
     WHERE s.review_status = ?
     ORDER BY s.created_at DESC`,
    [reviewStatus]
  );
  return rows;
}

async function findAdminByUsername(username) {
  const [rows] = await pool.query(
    "SELECT id, username, password_hash, display_name, status FROM admins WHERE username = ? LIMIT 1",
    [username]
  );
  return rows[0] || null;
}

async function insertVideo(data) {
  const [result] = await pool.query(
    `INSERT INTO highlight_videos
      (game_id, title, description, file_path, original_filename, mime_type, file_size, created_by, submitter_name, review_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.gameId,
      data.title,
      data.description,
      data.filePath,
      data.originalFilename,
      data.mimeType,
      data.fileSize,
      data.createdBy || null,
      data.submitterName || null,
      data.reviewStatus || "approved",
    ]
  );
  return result.insertId;
}

async function insertScreenshot(data) {
  const [result] = await pool.query(
    `INSERT INTO highlight_screenshots
      (game_id, title, description, file_path, thumbnail_path, original_filename, mime_type, file_size, created_by, submitter_name, review_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.gameId,
      data.title,
      data.description,
      data.filePath,
      data.thumbnailPath || null,
      data.originalFilename,
      data.mimeType,
      data.fileSize,
      data.createdBy || null,
      data.submitterName || null,
      data.reviewStatus || "approved",
    ]
  );
  return result.insertId;
}

async function getVideoById(id) {
  const [rows] = await pool.query("SELECT * FROM highlight_videos WHERE id = ? LIMIT 1", [id]);
  return rows[0] || null;
}

async function getScreenshotById(id) {
  const [rows] = await pool.query("SELECT * FROM highlight_screenshots WHERE id = ? LIMIT 1", [id]);
  return rows[0] || null;
}

async function deleteVideo(id) {
  await pool.query("DELETE FROM media_likes WHERE media_type = 'video' AND media_id = ?", [id]);
  await pool.query("DELETE FROM highlight_videos WHERE id = ?", [id]);
}

async function deleteScreenshot(id) {
  await pool.query("DELETE FROM media_likes WHERE media_type = 'screenshot' AND media_id = ?", [id]);
  await pool.query("DELETE FROM highlight_screenshots WHERE id = ?", [id]);
}

async function mediaExists(mediaType, mediaId) {
  if (mediaType === "video") {
    const [rows] = await pool.query(
      "SELECT id FROM highlight_videos WHERE id = ? AND review_status = 'approved' LIMIT 1",
      [mediaId]
    );
    return Boolean(rows[0]);
  }
  if (mediaType === "screenshot") {
    const [rows] = await pool.query(
      "SELECT id FROM highlight_screenshots WHERE id = ? AND review_status = 'approved' LIMIT 1",
      [mediaId]
    );
    return Boolean(rows[0]);
  }
  return false;
}

async function setReviewStatus(mediaType, mediaId, reviewStatus) {
  const table = mediaType === "video" ? "highlight_videos" : "highlight_screenshots";
  const [result] = await pool.query(`UPDATE ${table} SET review_status = ? WHERE id = ?`, [
    reviewStatus,
    mediaId,
  ]);
  return result.affectedRows > 0;
}

async function findUserByPhone(phone) {
  const [rows] = await pool.query(
    "SELECT id, phone, password_hash, nickname FROM users WHERE phone = ? LIMIT 1",
    [phone]
  );
  return rows[0] || null;
}

async function findUserById(id) {
  const [rows] = await pool.query(
    "SELECT id, phone, nickname, created_at FROM users WHERE id = ? LIMIT 1",
    [id]
  );
  return rows[0] || null;
}

async function createUser({ phone, passwordHash, nickname }) {
  const [result] = await pool.query(
    "INSERT INTO users (phone, password_hash, nickname) VALUES (?, ?, ?)",
    [phone, passwordHash, nickname]
  );
  return result.insertId;
}

async function insertSmsCode({ phone, code, scene, expiresAt }) {
  const [result] = await pool.query(
    "INSERT INTO sms_codes (phone, code, scene, expires_at) VALUES (?, ?, ?, ?)",
    [phone, code, scene, expiresAt]
  );
  return result.insertId;
}

async function getLatestSms(phone) {
  const [rows] = await pool.query(
    "SELECT id, created_at FROM sms_codes WHERE phone = ? ORDER BY id DESC LIMIT 1",
    [phone]
  );
  return rows[0] || null;
}

async function consumeSmsCode(phone, code, scene) {
  const [rows] = await pool.query(
    `SELECT id FROM sms_codes
     WHERE phone = ? AND code = ? AND scene = ? AND expires_at > NOW()
     ORDER BY id DESC LIMIT 1`,
    [phone, code, scene]
  );
  if (!rows[0]) return false;
  await pool.query("DELETE FROM sms_codes WHERE phone = ? AND scene = ?", [phone, scene]);
  return true;
}

async function toggleLike(mediaType, mediaId, userId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [existing] = await conn.query(
      `SELECT id FROM media_likes
       WHERE media_type = ? AND media_id = ? AND user_id = ?
       LIMIT 1`,
      [mediaType, mediaId, userId]
    );

    let liked;
    if (existing.length) {
      await conn.query("DELETE FROM media_likes WHERE id = ?", [existing[0].id]);
      liked = false;
    } else {
      await conn.query(
        `INSERT INTO media_likes (media_type, media_id, visitor_id, user_id) VALUES (?, ?, ?, ?)`,
        [mediaType, mediaId, `u:${userId}`, userId]
      );
      liked = true;
    }

    const [countRows] = await conn.query(
      `SELECT COUNT(*) AS n FROM media_likes WHERE media_type = ? AND media_id = ?`,
      [mediaType, mediaId]
    );
    await conn.commit();
    return { liked, likeCount: Number(countRows[0].n) };
  } catch (err) {
    await conn.rollback();
    if (err && err.code === "ER_DUP_ENTRY") {
      const [countRows] = await pool.query(
        `SELECT COUNT(*) AS n FROM media_likes WHERE media_type = ? AND media_id = ?`,
        [mediaType, mediaId]
      );
      return { liked: true, likeCount: Number(countRows[0].n) };
    }
    throw err;
  } finally {
    conn.release();
  }
}

function isReady() {
  return dbReady;
}

function getLastError() {
  return lastError;
}

function setLastError(err) {
  lastError = err;
  dbReady = false;
}

module.exports = {
  FALLBACK_GAMES,
  initDb,
  getGames,
  getGameById,
  getGameBySlug,
  listVideos,
  listScreenshots,
  listAllVideos,
  listAllScreenshots,
  findAdminByUsername,
  findUserByPhone,
  findUserById,
  createUser,
  insertSmsCode,
  getLatestSms,
  consumeSmsCode,
  insertVideo,
  insertScreenshot,
  getVideoById,
  getScreenshotById,
  deleteVideo,
  deleteScreenshot,
  mediaExists,
  setReviewStatus,
  toggleLike,
  isReady,
  getLastError,
  setLastError,
};
