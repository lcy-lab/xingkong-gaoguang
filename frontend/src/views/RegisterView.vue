<template>
  <section class="auth-wrap">
    <form class="panel" @submit.prevent="submit">
      <p class="eyebrow">Account</p>
      <h1>手机号注册</h1>
      <p class="empty">使用短信验证码注册账号后，即可投稿和点赞。</p>
      <p v-if="message" class="flash" :class="ok ? 'flash-ok' : 'flash-error'">{{ message }}</p>
      <label
        >手机号
        <input v-model="form.phone" type="tel" maxlength="11" autocomplete="tel" required />
      </label>
      <label class="sms-row">
        验证码
        <span class="sms-fields">
          <input v-model="form.code" type="text" maxlength="6" inputmode="numeric" required />
          <button type="button" class="ghost-btn" :disabled="smsBusy || countdown > 0" @click="sendCode">
            {{ countdown > 0 ? `${countdown}s` : smsBusy ? "发送中" : "获取验证码" }}
          </button>
        </span>
      </label>
      <label
        >昵称
        <input v-model="form.nickname" type="text" maxlength="40" required />
      </label>
      <label
        >密码
        <input v-model="form.password" type="password" autocomplete="new-password" minlength="6" required />
      </label>
      <button type="submit" :disabled="loading">{{ loading ? "注册中..." : "注册并登录" }}</button>
      <p class="hint">
        已有账号？
        <router-link :to="{ name: 'login', query: $route.query }">去登录</router-link>
      </p>
    </form>
  </section>
</template>

<script setup>
import { onUnmounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { api } from "../api";
import { registerUser } from "../stores/user";

const route = useRoute();
const router = useRouter();
const form = reactive({
  phone: "",
  code: "",
  nickname: "",
  password: "",
});
const message = ref("");
const ok = ref(false);
const loading = ref(false);
const smsBusy = ref(false);
const countdown = ref(0);
let timer = 0;

onUnmounted(() => {
  if (timer) clearInterval(timer);
});

function startCountdown() {
  countdown.value = 60;
  if (timer) clearInterval(timer);
  timer = setInterval(() => {
    countdown.value -= 1;
    if (countdown.value <= 0) {
      clearInterval(timer);
      timer = 0;
    }
  }, 1000);
}

async function sendCode() {
  smsBusy.value = true;
  message.value = "";
  try {
    const data = await api("/api/users/sms", {
      method: "POST",
      body: { phone: form.phone, scene: "register" },
    });
    ok.value = true;
    message.value = data.devHint || data.message;
    startCountdown();
  } catch (err) {
    ok.value = false;
    message.value = err.message;
  } finally {
    smsBusy.value = false;
  }
}

async function submit() {
  loading.value = true;
  message.value = "";
  try {
    await registerUser({
      phone: form.phone,
      code: form.code,
      nickname: form.nickname,
      password: form.password,
    });
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
