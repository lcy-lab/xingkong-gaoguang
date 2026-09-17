<template>
  <section class="auth-wrap">
    <form class="panel" @submit.prevent="submit">
      <p class="eyebrow">Account</p>
      <h1>登录</h1>
      <p class="empty">游客可以浏览作品。投稿和点赞需要先登录。</p>
      <p v-if="message" class="flash" :class="ok ? 'flash-ok' : 'flash-error'">{{ message }}</p>
      <label
        >手机号
        <input v-model="phone" type="tel" maxlength="11" autocomplete="tel" required />
      </label>
      <label
        >密码
        <input v-model="password" type="password" autocomplete="current-password" required />
      </label>
      <button type="submit" :disabled="loading">{{ loading ? "登录中..." : "登录" }}</button>
      <p class="hint">
        还没有账号？
        <router-link :to="{ name: 'register', query: $route.query }">用手机验证码注册</router-link>
      </p>
    </form>
  </section>
</template>

<script setup>
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { loginUser } from "../stores/user";

const route = useRoute();
const router = useRouter();
const phone = ref("");
const password = ref("");
const message = ref("");
const ok = ref(false);
const loading = ref(false);

async function submit() {
  loading.value = true;
  message.value = "";
  try {
    await loginUser(phone.value, password.value);
    ok.value = true;
    await router.replace(route.query.redirect || "/");
  } catch (err) {
    ok.value = false;
    message.value = err.message;
  } finally {
    loading.value = false;
  }
}
</script>
