const fs = require("fs");
const path = require("path");
const multer = require("multer");

const uploadRoot = path.join(__dirname, "..", "uploads");

function makeStorage(subdir) {
  return multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dest = path.join(uploadRoot, subdir);
      fs.mkdirSync(dest, { recursive: true });
      cb(null, dest);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase() || ".bin";
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    },
  });
}

const videoUpload = multer({
  storage: makeStorage("videos"),
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /\.(mp4|webm|mov|mkv)$/i.test(file.originalname || "");
    cb(ok ? null : new Error("仅支持 mp4 / webm / mov / mkv 视频"), ok);
  },
});

const imageUpload = multer({
  storage: makeStorage("screenshots"),
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /\.(jpe?g|png|webp|gif)$/i.test(file.originalname || "");
    cb(ok ? null : new Error("仅支持 jpg / png / webp / gif 图片"), ok);
  },
});

function unlinkUpload(filePath) {
  if (!filePath) return;
  const abs = path.join(uploadRoot, String(filePath).replace(/^\/uploads\/?/, ""));
  if (abs.startsWith(uploadRoot) && fs.existsSync(abs)) {
    fs.unlinkSync(abs);
  }
}

module.exports = { uploadRoot, videoUpload, imageUpload, unlinkUpload };
