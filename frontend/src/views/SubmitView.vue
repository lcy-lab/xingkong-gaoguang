<template>
  <section class="page">
    <div class="page-head">
      <p class="eyebrow">Contribute</p>
      <h1>投稿</h1>
      <p class="empty">登录后可上传高光视频或截图。管理员审核通过后，才会出现在对应游戏页面。</p>
    </div>

    <form class="panel submit-panel" @submit.prevent="submit">
      <p v-if="message" class="flash" :class="ok ? 'flash-ok' : 'flash-error'">{{ message }}</p>
      <label
        >投稿类型
        <select v-model="form.kind" required>
          <option value="video">高光视频</option>
          <option value="screenshot">高光截图</option>
        </select>
      </label>
      <label
        >所属游戏
        <select v-model="form.game_id" required>
          <option v-for="game in gamesState.list" :key="game.id" :value="game.id">{{ game.name }}</option>
        </select>
      </label>
      <label>标题 <input v-model="form.title" type="text" maxlength="120" required /></label>
      <label>你的昵称（可选） <input v-model="form.submitter_name" type="text" maxlength="40" /></label>
      <label>简介（可选） <input v-model="form.description" type="text" maxlength="500" /></label>
      <label>
        {{ form.kind === "video" ? "视频文件" : "截图文件" }}
        <input
          :key="form.kind"
          type="file"
          :accept="form.kind === 'video' ? 'video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.mkv' : 'image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif'"
          required
          @change="onFile"
        />
      </label>
      <button type="submit" :disabled="busy">{{ busy ? "提交中..." : "提交审核" }}</button>
    </form>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref } from "vue";
import { api } from "../api";
import { gamesState, loadGames } from "../stores/games";
import { userState } from "../stores/user";

const form = reactive({
  kind: "screenshot",
  game_id: "",
  title: "",
  submitter_name: "",
  description: "",
});
const file = ref(null);
const busy = ref(false);
const message = ref("");
const ok = ref(false);

function onFile(event) {
  file.value = event.target.files[0] || null;
}

onMounted(async () => {
  if (!gamesState.list.length) {
    try {
      await loadGames();
    } catch {
      message.value = "无法加载游戏列表。";
    }
  }
  if (!form.game_id && gamesState.list[0]) form.game_id = gamesState.list[0].id;
  if (!form.submitter_name && userState.user?.nickname) {
    form.submitter_name = userState.user.nickname;
  }
});

async function submit() {
  if (!file.value) return;
  busy.value = true;
  message.value = "";
  try {
    const data = new FormData();
    data.append("game_id", String(form.game_id));
    data.append("title", form.title);
    data.append("description", form.description);
    data.append("submitter_name", form.submitter_name);
    data.append("file", file.value);
    const path = form.kind === "video" ? "/api/submissions/videos" : "/api/submissions/screenshots";
    const result = await api(path, { method: "POST", body: data });
    ok.value = true;
    message.value = result.message;
    form.title = "";
    form.description = "";
    form.submitter_name = "";
    file.value = null;
  } catch (err) {
    ok.value = false;
    message.value = err.message;
  } finally {
    busy.value = false;
  }
}
</script>
