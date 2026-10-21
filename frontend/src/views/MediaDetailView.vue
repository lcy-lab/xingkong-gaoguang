<template>
  <section class="page detail-page">
    <div v-if="error" class="empty">{{ error }}</div>
    <p v-else-if="loading" class="empty">加载中...</p>
    <template v-else-if="item && game">
      <router-link class="detail-back" :to="listPath">← 返回{{ game.name }}</router-link>

      <article class="detail-card">
        <div v-if="kind === 'video'" class="detail-media">
          <video class="detail-video" controls preload="metadata" :src="item.file_path"></video>
        </div>
        <div v-else class="detail-media">
          <img :src="item.file_path" :alt="item.title" />
        </div>
        <div class="detail-body">
          <h1>{{ item.title }}</h1>
          <p v-if="item.description" class="detail-desc">{{ item.description }}</p>
          <p v-if="item.submitter_name" class="detail-meta">投稿：{{ item.submitter_name }}</p>
          <div class="media-actions">
            <span class="comment-btn comment-btn-static">
              <span class="comment-icon" aria-hidden="true">💬</span>
              <span>{{ item.comment_count || 0 }}</span>
            </span>
            <LikeButton :item="item" :type="kind" />
          </div>
        </div>
      </article>

      <CommentSection :type="kind" :media-id="Number(item.id)" @count-change="onCountChange" />
    </template>
  </section>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { api } from "../api";
import LikeButton from "../components/LikeButton.vue";
import CommentSection from "../components/CommentSection.vue";

const props = defineProps({
  kind: { type: String, required: true },
});

const route = useRoute();
const game = ref(null);
const item = ref(null);
const error = ref("");
const loading = ref(false);

const listPath = computed(() => {
  const kind = props.kind === "video" ? "videos" : "screenshots";
  return `/games/${route.params.slug}/${kind}`;
});

function onCountChange(count) {
  if (item.value) item.value.comment_count = count;
}

async function load() {
  error.value = "";
  loading.value = true;
  const kind = props.kind === "video" ? "videos" : "screenshots";
  try {
    const data = await api(`/api/games/${route.params.slug}/${kind}/${route.params.id}`);
    game.value = data.game;
    item.value = data.item;
    document.title = `${data.item.title} · ${data.game.name} · 星穹高光`;
  } catch (err) {
    error.value = err.message;
    item.value = null;
  } finally {
    loading.value = false;
  }
}

watch(() => [route.params.slug, route.params.id, props.kind], load, { immediate: true });
</script>
