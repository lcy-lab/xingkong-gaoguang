import { reactive } from "vue";
import { api, setToken } from "../api";

export const authState = reactive({
  token: localStorage.getItem("game_admin_token") || "",
  admin: null,
});

export function isLoggedIn() {
  return Boolean(authState.token);
}

export async function login(username, password) {
  const data = await api("/api/auth/login", {
    method: "POST",
    body: { username, password },
  });
  setToken(data.token);
  authState.token = data.token;
  authState.admin = data.admin;
  return data;
}

export function logout() {
  setToken("");
  authState.token = "";
  authState.admin = null;
}
