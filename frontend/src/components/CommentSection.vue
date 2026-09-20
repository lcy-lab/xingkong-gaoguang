<template>
  <section class="comments" @click.stop>
    <h3 class="comments-title">评论 {{ totalCount }}</h3>
    <p v-if="error" class="comments-error">{{ error }}</p>
    <p v-else-if="loading" class="comments-empty">加载评论...</p>
    <p v-else-if="!comments.length" class="comments-empty">还没有评论。</p>

    <ul v-if="comments.length" class="comment-list">
      <li v-for="item in comments" :key="item.id" class="comment-item">
        <div class="comment-head">
          <strong>{{ item.nickname }}</strong>
          <time>{{ formatTime(item.created_at) }}</time>
        </div>
        <p class="comment-text">{{ item.content }}</p>
        <div class="comment-actions">
          <button
            type="button"
            class="like-btn"
            :class="{ liked: item.liked }"
            :disabled="likeBusy === item.id"
            @click="toggleLike(item)"
          >
            <span class="like-icon">{{ item.liked ? "♥" : "♡" }}</span>
            <span>{{ item.like_count || 0 }}</span>
          </button>
          <button type="button" class="ghost-btn comment-reply-btn" @click="startReply(item)">回复</button>
        </div>

        <ul v-if="item.replies && item.replies.length" class="comment-replies">
          <li v-for="reply in item.replies" :key="reply.id" class="comment-item">
            <div class="comment-head">
              <strong>{{ reply.nickname }}</strong>
              <time>{{ formatTime(reply.created_at) }}</time>
            </div>
            <p class="comment-text">{{ reply.content }}</p>
            <div class="comment-actions">
              <button
                type="button"
                class="like-btn"
                :class="{ liked: reply.liked }"
                :disabled="likeBusy === reply.id"
                @click="toggleLike(reply)"
              >
                <span class="like-icon">{{ reply.liked ? "♥" : "♡" }}</span>
                <span>{{ reply.like_count || 0 }}</span>
              </button>
              <button type="button" class="ghost-btn comment-reply-btn" @click="startReply(item, reply)">
                回复
              </button>
            </div>
          </li>
        </ul>
      </li>
    </ul>

    <form class="comment-form" @submit.prevent="submit">
      <p v-if="replyTo" class="comment-replying">
        回复 {{ replyTo.nickname }}
        <button type="button" class="comment-cancel" @click="clearReply">取消</button>
      </p>
      <textarea
        v-model="draft"
        maxlength="500"
        rows="3"
        :placeholder="isUserLoggedIn() ? placeholder : '登录后才能评论'"
        @focus="ensureLogin"
      ></textarea>
      <button type="submit" :disabled="posting">{{ posting ? "发送中..." : "发表评论" }}</button>
    </form>
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { api } from "../api";
import { isUserLoggedIn } from "../stores/user";

const props = defineProps({
  type: { type: String, required: true },
  mediaId: { type: Number, required: true },
});

const route = useRoute();
const router = useRouter();
const comments = ref([]);
const loading = ref(false);
const error = ref("");
const draft = ref("");
const posting = ref(false);
const likeBusy = ref(0);
const replyTo = ref(null);

const totalCount = computed(() =>
  comments.value.reduce((sum, item) => sum + 1 + (item.replies?.length || 0), 0)
);

const placeholder = computed(() =>
  replyTo.value ? `回复 ${replyTo.value.nickname}` : "写下你的评论"
);

function formatTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function goLogin() {
  router.push({ name: "login", query: { redirect: route.fullPath } });
}

function ensureLogin() {
  if (!isUserLoggedIn()) goLogin();
}

function startReply(root, reply) {
  if (!isUserLoggedIn()) {
    goLogin();
    return;
  }
  replyTo.value = reply || root;
}

function clearReply() {
  replyTo.value = null;
}

async function load() {
  if (!props.mediaId) return;
  loading.value = true;
  error.value = "";
  try {
    const data = await api(`/api/comments?type=${props.type}&id=${props.mediaId}`);
    comments.value = data.comments || [];
  } catch (err) {
    error.value = err.message;
    comments.value = [];
  } finally {
    loading.value = false;
  }
}

async function submit() {
  if (!isUserLoggedIn()) {
    goLogin();
    return;
  }
  const content = draft.value.trim();
  if (!content || posting.value) return;
  posting.value = true;
  error.value = "";
  try {
    const data = await api("/api/comments", {
      method: "POST",
      body: {
        type: props.type,
        id: props.mediaId,
        content,
        parent_id: replyTo.value?.id || null,
      },
    });
    const created = data.comment;
    created.replies = created.replies || [];
    if (created.parent_id) {
      const root = comments.value.find((item) => item.id === created.parent_id);
      if (root) root.replies.push(created);
      else comments.value.push(created);
    } else {
      comments.value.push(created);
    }
    draft.value = "";
    clearReply();
  } catch (err) {
    if (err.status === 401) goLogin();
    else error.value = err.message;
  } finally {
    posting.value = false;
  }
}

async function toggleLike(item) {
  if (!isUserLoggedIn()) {
    goLogin();
    return;
  }
  if (likeBusy.value) return;
  likeBusy.value = item.id;
  try {
    const data = await api(`/api/comments/${item.id}/like`, { method: "POST" });
    item.liked = data.liked;
    item.like_count = data.likeCount;
  } catch (err) {
    if (err.status === 401) goLogin();
  } finally {
    likeBusy.value = 0;
  }
}

onMounted(load);
watch(() => [props.type, props.mediaId], load);
</script>
