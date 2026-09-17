const ADMIN_TOKEN_KEY = "game_admin_token";
const USER_TOKEN_KEY = "game_user_token";

export function getAdminToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY) || "";
}

export function setAdminToken(token) {
  if (token) localStorage.setItem(ADMIN_TOKEN_KEY, token);
  else localStorage.removeItem(ADMIN_TOKEN_KEY);
}

export function getUserToken() {
  return localStorage.getItem(USER_TOKEN_KEY) || "";
}

export function setUserToken(token) {
  if (token) localStorage.setItem(USER_TOKEN_KEY, token);
  else localStorage.removeItem(USER_TOKEN_KEY);
}

export function getToken() {
  return getAdminToken();
}

export function setToken(token) {
  setAdminToken(token);
}

function pickToken(path) {
  if (path.startsWith("/api/auth") || path.startsWith("/api/admin")) {
    return getAdminToken();
  }
  return getUserToken();
}

export async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = pickToken(path);
  if (token) headers.Authorization = `Bearer ${token}`;

  let body = options.body;
  if (body && !(body instanceof FormData) && typeof body === "object") {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(body);
  }

  const res = await fetch(path, { ...options, headers, body });
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const err = new Error("接口没有到达后端。请在 Nginx 把 /api 和 /uploads 反向代理到 Node（端口 3000）。");
    err.status = res.status;
    throw err;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || "请求失败");
    err.status = res.status;
    throw err;
  }
  return data;
}
