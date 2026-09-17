<template>
  <section class="page admin-page">
    <div class="page-head admin-head">
      <div>
        <p class="eyebrow">控制台</p>
        <h1>素材管理</h1>
      </div>
      <button class="ghost" type="button" @click="onLogout">退出</button>
    </div>

    <p v-if="flash" class="flash" :class="flash.ok ? 'flash-ok' : 'flash-error'">{{ flash.text }}</p>

    <section class="panel review-panel">
      <h2>待审核投稿</h2>
      <p v-if="!pendingVideos.length && !pendingScreenshots.length" class="empty">暂无待审核内容。</p>
      <ul v-else class="review-list">
        <li v-for="item in pendingVideos" :key="'v-' + item.id" class="review-item">
          <video class="review-media" controls preload="metadata" :src="item.file_path"></video>
          <div>
            <strong>{{ item.title }}</strong>
            <span>{{ item.game_name }} · 视频 · {{ item.submitter_name || "匿名" }}</span>
            <p v-if="item.description">{{ item.description }}</p>
          </div>
          <div class="review-actions">
            <button type="button" @click="review('videos', item.id, 'approve')">通过</button>
            <button class="danger" type="button" @click="review('videos', item.id, 'reject')">拒绝</button>
          </div>
        </li>
        <li v-for="item in pendingScreenshots" :key="'s-' + item.id" class="review-item">
          <img class="review-media" :src="item.thumbnail_path || item.file_path" :alt="item.title" />
          <div>
            <strong>{{ item.title }}</strong>
            <span>{{ item.game_name }} · 截图 · {{ item.submitter_name || "匿名" }}</span>
            <p v-if="item.description">{{ item.description }}</p>
          </div>
          <div class="review-actions">
            <button type="button" @click="review('screenshots', item.id, 'approve')">通过</button>
            <button class="danger" type="button" @click="review('screenshots', item.id, 'reject')">拒绝</button>
          </div>
        </li>
      </ul>
    </section>

    <div class="admin-grid">
      <form class="panel" @submit.prevent="uploadVideo">
        <h2>添加高光视频</h2>
        <label
          >所属游戏
          <select v-model="videoForm.game_id" required>
            <option v-for="game in games" :key="game.id" :value="game.id">{{ game.name }}</option>
          </select>
        </label>
        <label>标题 <input v-model="videoForm.title" type="text" maxlength="120" required /></label>
        <label>简介（可选） <input v-model="videoForm.description" type="text" maxlength="500" /></label>
        <label>视频文件 <input type="file" accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.mkv" @change="onVideoFile" required /></label>
        <button type="submit" :disabled="busy">上传视频</button>
      </form>

      <form class="panel" @submit.prevent="uploadShot">
        <h2>添加高光截图</h2>
        <label
          >所属游戏
          <select v-model="shotForm.game_id" required>
            <option v-for="game in games" :key="game.id" :value="game.id">{{ game.name }}</option>
          </select>
        </label>
        <label>标题 <input v-model="shotForm.title" type="text" maxlength="120" required /></label>
        <label>简介（可选） <input v-model="shotForm.description" type="text" maxlength="500" /></label>
        <label>截图文件 <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif" @change="onShotFile" required /></label>
        <button type="submit" :disabled="busy">上传截图</button>
      </form>
    </div>

    <div class="admin-lists">
      <section class="panel">
        <h2>已有视频</h2>
        <p v-if="!videos.length" class="empty">还没有视频。</p>
        <ul v-else class="admin-list">
          <li v-for="item in videos" :key="item.id">
            <div>
              <strong>{{ item.title }}</strong>
              <span>{{ item.game_name }}</span>
            </div>
            <button class="danger" type="button" @click="removeVideo(item.id)">删除</button>
          </li>
        </ul>
      </section>
      <section class="panel">
        <h2>已有截图</h2>
        <p v-if="!screenshots.length" class="empty">还没有截图。</p>
        <ul v-else class="admin-list">
          <li v-for="item in screenshots" :key="item.id">
            <div>
              <strong>{{ item.title }}</strong>
              <span>{{ item.game_name }}</span>
            </div>
            <button class="danger" type="button" @click="removeShot(item.id)">删除</button>
          </li>
        </ul>
      </section>
    </div>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { api } from "../api";
import { logout } from "../stores/auth";

const router = useRouter();
const games = ref([]);
const videos = ref([]);
const screenshots = ref([]);
const pendingVideos = ref([]);
const pendingScreenshots = ref([]);
const flash = ref(null);
const busy = ref(false);
const videoFile = ref(null);
const shotFile = ref(null);
const videoForm = reactive({ game_id: "", title: "", description: "" });
const shotForm = reactive({ game_id: "", title: "", description: "" });

function onVideoFile(e) {
  videoFile.value = e.target.files[0] || null;
}
function onShotFile(e) {
  shotFile.value = e.target.files[0] || null;
}

async function loadDashboard() {
  const data = await api("/api/admin/dashboard");
  games.value = data.games || [];
  videos.value = data.videos || [];
  screenshots.value = data.screenshots || [];
  pendingVideos.value = data.pendingVideos || [];
  pendingScreenshots.value = data.pendingScreenshots || [];
  if (!videoForm.game_id && games.value[0]) videoForm.game_id = games.value[0].id;
  if (!shotForm.game_id && games.value[0]) shotForm.game_id = games.value[0].id;
}

async function uploadVideo() {
  if (!videoFile.value) return;
  busy.value = true;
  try {
    const form = new FormData();
    form.append("game_id", String(videoForm.game_id));
    form.append("title", videoForm.title);
    form.append("description", videoForm.description);
    form.append("file", videoFile.value);
    const data = await api("/api/admin/videos", { method: "POST", body: form });
    flash.value = { ok: true, text: data.message };
    videoForm.title = "";
    videoForm.description = "";
    videoFile.value = null;
    await loadDashboard();
  } catch (err) {
    flash.value = { ok: false, text: err.message };
  } finally {
    busy.value = false;
  }
}

async function uploadShot() {
  if (!shotFile.value) return;
  busy.value = true;
  try {
    const form = new FormData();
    form.append("game_id", String(shotForm.game_id));
    form.append("title", shotForm.title);
    form.append("description", shotForm.description);
    form.append("file", shotFile.value);
    const data = await api("/api/admin/screenshots", { method: "POST", body: form });
    flash.value = { ok: true, text: data.message };
    shotForm.title = "";
    shotForm.description = "";
    shotFile.value = null;
    await loadDashboard();
  } catch (err) {
    flash.value = { ok: false, text: err.message };
  } finally {
    busy.value = false;
  }
}

async function review(kind, id, action) {
  const data = await api(`/api/admin/${kind}/${id}/review`, {
    method: "POST",
    body: { action },
  });
  flash.value = { ok: true, text: data.message };
  await loadDashboard();
}

async function removeVideo(id) {
  if (!confirm("确定删除这条视频？")) return;
  await api(`/api/admin/videos/${id}`, { method: "DELETE" });
  flash.value = { ok: true, text: "视频已删除。" };
  await loadDashboard();
}

async function removeShot(id) {
  if (!confirm("确定删除这张截图？")) return;
  await api(`/api/admin/screenshots/${id}`, { method: "DELETE" });
  flash.value = { ok: true, text: "截图已删除。" };
  await loadDashboard();
}

function onLogout() {
  logout();
  router.push("/admin/login");
}

onMounted(async () => {
  try {
    await loadDashboard();
  } catch (err) {
    flash.value = { ok: false, text: err.message };
    if (err.status === 401) {
      logout();
      router.push("/admin/login");
    }
  }
});
</script>
