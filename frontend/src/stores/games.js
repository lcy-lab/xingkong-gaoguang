import { reactive } from "vue";
import { api } from "../api";

export const gamesState = reactive({
  list: [],
  dbReady: true,
  dbError: "",
});

export async function loadGames() {
  const data = await api("/api/games");
  gamesState.list = data.games || [];
  gamesState.dbReady = Boolean(data.dbReady);
  gamesState.dbError = data.dbError || "";
}
