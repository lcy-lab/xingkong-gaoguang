<template>
  <header class="site-header">
    <router-link class="brand" to="/">星穹高光</router-link>
    <nav class="nav">
      <router-link class="nav-link" to="/">首页</router-link>
      <div
        v-for="game in gamesState.list"
        :key="game.slug"
        class="nav-item"
        :class="{ open: openSlug === game.slug }"
      >
        <button class="nav-link nav-trigger" type="button" @click.stop="toggle(game.slug)">
          {{ game.name }}
        </button>
        <div class="nav-dropdown">
          <router-link :to="`/games/${game.slug}/videos`" @click="openSlug = ''">高光视频</router-link>
          <router-link :to="`/games/${game.slug}/screenshots`" @click="openSlug = ''">高光截图</router-link>
        </div>
      </div>
      <router-link class="nav-link" to="/submit">投稿</router-link>
      <template v-if="userState.token">
        <span class="nav-user">{{ userState.user?.nickname || "已登录" }}</span>
        <button class="nav-link nav-trigger" type="button" @click="onLogout">退出</button>
      </template>
      <router-link v-else class="nav-link" to="/login">登录</router-link>
      <!-- <router-link class="nav-link admin-link" :to="isLoggedIn() ? '/admin' : '/admin/login'">
        {{ isLoggedIn() ? "后台" : "管理员" }}
      </router-link> -->
    </nav>
  </header>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import { gamesState } from "../stores/games";
import { logoutUser, userState } from "../stores/user";

const router = useRouter();
const openSlug = ref("");

function toggle(slug) {
  openSlug.value = openSlug.value === slug ? "" : slug;
}

function close(event) {
  if (!event.target.closest(".nav-item")) openSlug.value = "";
}

function onLogout() {
  logoutUser();
  if (router.currentRoute.value.meta.requiresUser) {
    router.push({ name: "login" });
  }
}

onMounted(() => document.addEventListener("click", close));
onUnmounted(() => document.removeEventListener("click", close));
</script>
