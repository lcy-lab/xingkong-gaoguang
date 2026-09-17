<template>
  <AppNav />
  <router-view />
</template>

<script setup>
import { onMounted } from "vue";
import AppNav from "./components/AppNav.vue";
import { loadGames } from "./stores/games";
import { fetchCurrentUser } from "./stores/user";

onMounted(() => {
  loadGames().catch(() => {});
  fetchCurrentUser().catch(() => {});
});
</script>
