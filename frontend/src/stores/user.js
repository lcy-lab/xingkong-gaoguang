import { reactive } from "vue";
import { api, setUserToken } from "../api";

export const userState = reactive({
  token: localStorage.getItem("game_user_token") || "",
  user: null,
});

export function isUserLoggedIn() {
  return Boolean(userState.token);
}

export async function fetchCurrentUser() {
  if (!userState.token) {
    userState.user = null;
    return null;
  }
  try {
    const data = await api("/api/users/me");
    userState.user = data.user;
    return data.user;
  } catch {
    setUserToken("");
    userState.token = "";
    userState.user = null;
    return null;
  }
}

export async function loginUser(phone, password) {
  const data = await api("/api/users/login", {
    method: "POST",
    body: { phone, password },
  });
  setUserToken(data.token);
  userState.token = data.token;
  userState.user = data.user;
  return data;
}

export async function registerUser(payload) {
  const data = await api("/api/users/register", {
    method: "POST",
    body: payload,
  });
  setUserToken(data.token);
  userState.token = data.token;
  userState.user = data.user;
  return data;
}

export function logoutUser() {
  setUserToken("");
  userState.token = "";
  userState.user = null;
}
