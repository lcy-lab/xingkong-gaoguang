<template>
  <section class="auth-wrap">
    <form class="panel" @submit.prevent="submit">
      <p class="eyebrow">Admin</p>
      <h1>管理员登录</h1>
      <p v-if="message" class="flash" :class="ok ? 'flash-ok' : 'flash-error'">{{ message }}</p>
      <label
        >账号
        <input v-model="username" type="text" autocomplete="username" required />
      </label>
      <label
        >密码
        <input v-model="password" type="password" autocomplete="current-password" required />
      </label>
      <button type="submit" :disabled="loading">{{ loading ? "登录中..." : "进入后台" }}</button>
      <p class="hint">首次启动后端会自动创建账号：admin / admin123</p>
    </form>
  </section>
</template>

<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { login } from "../stores/auth";

const router = useRouter();
const username = ref("admin");
const password = ref("");
const message = ref("");
const ok = ref(false);
const loading = ref(false);

async function submit() {
  loading.value = true;
  message.value = "";
  try {
    await login(username.value, password.value);
    ok.value = true;
    await router.push("/admin");
  } catch (err) {
    ok.value = false;
    message.value = err.message;
  } finally {
    loading.value = false;
  }
}
</script>
