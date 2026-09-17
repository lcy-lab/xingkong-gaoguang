const fs = require("fs");
const path = require("path");

const uploadRoot = path.join(__dirname, "..", "uploads");

function toAbs(filePath) {
  if (!filePath) return "";
  return path.join(uploadRoot, String(filePath).replace(/^\/uploads\/?/, ""));
}

async function makeThumbnail(originalPublicPath) {
  const abs = toAbs(originalPublicPath);
  if (!abs || !fs.existsSync(abs)) return null;

  const thumbsDir = path.join(uploadRoot, "screenshots", "thumbs");
  fs.mkdirSync(thumbsDir, { recursive: true });

  const base = path.parse(abs).name;
  const thumbName = `${base}.jpg`;
  const thumbAbs = path.join(thumbsDir, thumbName);
  const publicPath = `/uploads/screenshots/thumbs/${thumbName}`;

  if (fs.existsSync(thumbAbs)) return publicPath;

  try {
    const sharp = require("sharp");
    await sharp(abs, { animated: false, failOn: "none" })
      .rotate()
      .resize({ width: 480, height: 270, fit: "cover", position: "centre" })
      .jpeg({ quality: 72, mozjpeg: true })
      .toFile(thumbAbs);
    return publicPath;
  } catch (err) {
    console.error("生成缩略图失败：", err.message);
    return null;
  }
}

module.exports = { uploadRoot, toAbs, makeThumbnail };
