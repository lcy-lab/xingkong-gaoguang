require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const db = require("./src/db");
const publicRoutes = require("./src/routes/public");
const userRoutes = require("./src/routes/users");
const adminRoutes = require("./src/routes/admin");

const app = express();
const port = Number(process.env.PORT || 3000);
const allowedOrigins = String(
  process.env.FRONTEND_ORIGIN || "http://localhost:5173,http://127.0.0.1:5173"
)
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("CORS 未允许该来源：" + origin));
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, dbReady: db.isReady() });
});

app.use("/api", publicRoutes);
app.use("/api", userRoutes);
app.use("/api", adminRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "接口不存在。" });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: "服务器内部错误" });
});

async function start() {
  try {
    await db.initDb();
    console.log("MySQL 已连接，数据表已就绪。");
  } catch (err) {
    db.setLastError(
      "无法连接 MySQL。请在 backend/.env 填写正确的 DB_PASSWORD 后重启。原始错误：" + err.message
    );
    console.error("数据库初始化失败：", err.message);
  }

  const server = app.listen(port, "0.0.0.0", () => {
    console.log(`后端 API：http://0.0.0.0:${port}`);
  });

  server.on("error", (err) => {
    if (err && err.code === "EADDRINUSE") {
      console.error(`端口 ${port} 已被占用。不要重复执行 node server.js。`);
      console.error("先查占用：ss -lptn 'sport = :3000' 或 lsof -i :3000");
      console.error("再结束旧进程：kill -9 <PID>，或在宝塔「进程/PM2」里重启已有服务。");
      process.exit(1);
    }
    throw err;
  });
}

start();
