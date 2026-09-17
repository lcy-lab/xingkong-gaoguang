# 星穹高光

游戏高光视频与截图门户。前台按游戏浏览高光视频、高光截图；后台管理员可登录后添加、删除素材。

采用 **前后端分离**：前端 Vue 单页应用调用后端 REST API，视频和截图文件保存在服务器磁盘，路径写入 MySQL。

## 技术栈

| 层级 | 技术 |
| --- | --- |
| 前端 | Vue 3、Vue Router 4、Vite 6 |
| 后端 | Node.js、Express 4 |
| 数据库 | MySQL 8（`mysql2`） |
| 鉴权 | JWT（`jsonwebtoken`）、密码哈希（`bcryptjs`） |
| 上传 | Multer |
| 跨域 | CORS；开发时由 Vite 代理 `/api`、`/uploads` |

## 目录结构

```text
Game/
├── backend/                 # 后端 API
│   ├── server.js
│   ├── sql/schema.sql       # 建库建表
│   ├── src/db.js
│   ├── src/middleware/auth.js
│   ├── src/routes/public.js
│   ├── src/routes/admin.js
│   └── uploads/             # 视频 / 截图实体文件
├── frontend/                # 前端 SPA
│   ├── src/views/
│   ├── src/components/
│   ├── src/stores/
│   └── public/images/xingkong.jpg
└── README.md
```

## 环境要求

- Node.js 18+
- MySQL 8.0（本机服务默认端口 `3306`）

## 快速启动

1. 复制并编辑后端环境变量：

```bash
copy backend\.env.example backend\.env
```

在 `backend/.env` 中填写 MySQL 密码等配置（见下表）。

2. 安装依赖并同时启动前后端（在项目根目录）：

```bash
npm install
npm install --prefix backend
npm install --prefix frontend
npm run dev
```

3. 浏览器访问前台：**http://localhost:5173**

后端 API：**http://localhost:3000**（不要用 3000 打开页面）。

也可分两个终端启动：

```bash
npm run dev:backend
npm run dev:frontend
```

首次成功连接数据库时，后端会自动执行 `backend/sql/schema.sql`、写入 5 个游戏，并创建默认管理员。

### 默认管理员

| 项目 | 值 |
| --- | --- |
| 账号 | `admin` |
| 密码 | `admin123` |

后台入口：http://localhost:5173/admin/login

## 数据库信息

| 项 | 说明 |
| --- | --- |
| 库名 | `game_portal` |
| 字符集 | `utf8mb4` / `utf8mb4_unicode_ci` |
| 引擎 | InnoDB |
| 建表脚本 | `backend/sql/schema.sql` |

`backend/.env` 中与数据库相关的变量：

| 变量 | 默认 / 含义 |
| --- | --- |
| `DB_HOST` | `localhost` |
| `DB_PORT` | `3306` |
| `DB_USER` | `root` |
| `DB_PASSWORD` | MySQL 密码（必填） |
| `DB_NAME` | `game_portal` |
| `PORT` | 后端端口，默认 `3000` |
| `JWT_SECRET` | 签发登录令牌的密钥 |
| `ADMIN_USERNAME` | 首次初始化管理员用户名 |
| `ADMIN_PASSWORD` | 首次初始化管理员明文密码（入库时哈希） |
| `FRONTEND_ORIGIN` | CORS 允许来源，默认 `http://localhost:5173` |

### 表关系

```text
admins 1 ──< highlight_videos   >── N:1 games
admins 1 ──< highlight_screenshots >── N:1 games
```

| 表 | 作用 |
| --- | --- |
| `admins` | 管理员账号，密码存 `password_hash` |
| `games` | 顶部导航中的游戏（不含首页） |
| `highlight_videos` | 高光视频元数据，`file_path` 指向磁盘文件 |
| `highlight_screenshots` | 高光截图元数据 |

- `highlight_videos.game_id`、`highlight_screenshots.game_id` → `games.id`（删除游戏时级联删除素材记录）
- `created_by` → `admins.id`（删除管理员时置空，素材保留）

`games.slug` 与前台路由对应：

| slug | 游戏 |
| --- | --- |
| `lol` | 英雄联盟 |
| `valorant` | 无畏契约 |
| `qqspeed` | QQ飞车 |
| `hok` | 王者荣耀 |
| `tft` | 金铲铲之战 |

文件实际存放在 `backend/uploads/videos/` 与 `backend/uploads/screenshots/`，库中存形如 `/uploads/videos/xxx.mp4` 的路径。

## 接口说明

基址：`http://localhost:3000`  
开发环境下前端可直接请求相对路径 `/api/...`（Vite 会转发到后端）。

成功响应一般为 JSON。失败时返回 `{ "message": "原因" }`，常见状态码：`400` 参数错误、`401` 未登录或账号密码错误、`404` 不存在、`503` 数据库未连接。

需要登录的接口请在请求头携带：

```http
Authorization: Bearer <登录返回的 token>
```

令牌有效期 8 小时。

### 健康检查与公开接口

#### `GET /api/health`

检查服务是否启动。

```json
{ "ok": true, "dbReady": true }
```

#### `GET /api/games`

导航用游戏列表。

```json
{
  "games": [
    { "id": 1, "slug": "lol", "name": "英雄联盟", "sort_order": 1 }
  ],
  "dbReady": true,
  "dbError": null
}
```

#### `GET /api/games/:slug/videos`

某游戏的高光视频。`slug` 如 `lol`、`valorant`。

```json
{
  "game": { "id": 1, "slug": "lol", "name": "英雄联盟" },
  "items": [
    {
      "id": 1,
      "title": "五杀",
      "description": null,
      "file_path": "/uploads/videos/xxx.mp4",
      "created_at": "2026-09-07T12:00:00.000Z"
    }
  ]
}
```

播放地址：`http://localhost:3000` + `file_path`（经 Vite 时代理后可用相对路径 `file_path`）。

#### `GET /api/games/:slug/screenshots`

某游戏的高光截图，响应结构与视频接口相同，`file_path` 为图片路径。

### 认证

#### `POST /api/auth/login`

请求体（JSON）：

```json
{ "username": "admin", "password": "admin123" }
```

成功：

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "admin": { "id": 1, "username": "admin", "displayName": "管理员" }
}
```

#### `GET /api/auth/me`

校验当前令牌，需 `Authorization`。返回 `{ "admin": { ... } }`。

### 管理端（均需登录 + 数据库已连接）

#### `GET /api/admin/dashboard`

后台首页数据：游戏列表、全部视频、全部截图。

```json
{
  "games": [],
  "videos": [
    {
      "id": 1,
      "title": "五杀",
      "file_path": "/uploads/videos/xxx.mp4",
      "created_at": "...",
      "game_name": "英雄联盟",
      "game_slug": "lol"
    }
  ],
  "screenshots": []
}
```

#### `POST /api/admin/videos`

`multipart/form-data`：

| 字段 | 说明 |
| --- | --- |
| `game_id` | 游戏 ID |
| `title` | 标题（必填） |
| `description` | 简介（可选） |
| `file` | 视频文件，`mp4` / `webm` / `mov` / `mkv`，最大 200MB |

#### `POST /api/admin/screenshots`

字段同上；`file` 为图片，`jpg` / `png` / `webp` / `gif`，最大 12MB。

#### `DELETE /api/admin/videos/:id`

删除视频记录及磁盘文件。

#### `DELETE /api/admin/screenshots/:id`

删除截图记录及磁盘文件。

### 调用示例

登录：

```bash
curl -X POST http://localhost:3000/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"username\":\"admin\",\"password\":\"admin123\"}"
```

带令牌拉后台数据：

```bash
curl http://localhost:3000/api/admin/dashboard ^
  -H "Authorization: Bearer 这里填token"
```

上传截图（将 `TOKEN` 换成实际令牌）：

```bash
curl -X POST http://localhost:3000/api/admin/screenshots ^
  -H "Authorization: Bearer TOKEN" ^
  -F "game_id=1" ^
  -F "title=精彩击杀" ^
  -F "file=@C:\path\to\shot.jpg"
```

## 前端页面

| 路径 | 说明 |
| --- | --- |
| `/` | 首页，背景图 `xingkong.jpg`，中间文案 `hello world` |
| `/games/:slug/videos` | 高光视频 |
| `/games/:slug/screenshots` | 高光截图 |
| `/admin/login` | 管理员登录 |
| `/admin` | 素材管理（需登录） |

导航游戏列表来自 `GET /api/games`；每个游戏二级菜单为「高光视频」「高光截图」。

## 静态资源

- 首页背景：`frontend/public/images/xingkong.jpg`
- 用户上传：`backend/uploads/`，HTTP 路径 `/uploads/...`
