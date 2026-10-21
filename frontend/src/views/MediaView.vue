<template>
  <section class="page">
    <div v-if="error" class="empty">{{ error }}</div>
    <template v-else-if="game">
      <div class="page-head">
        <p class="eyebrow">{{ game.name }}</p>
        <h1>{{ kind === "video" ? "高光视频" : "高光截图" }}</h1>
      </div>

      <p v-if="loading" class="empty">加载中...</p>
      <p v-else-if="!items.length" class="empty">暂无内容。去投稿。</p>

      <div v-else-if="kind === 'video'" class="media-grid">
        <article v-for="item in items" :key="item.id" class="card">
          <div class="video-shell">
            <video
              v-if="playingId === item.id"
              class="card-media"
              controls
              autoplay
              preload="none"
              :src="item.file_path"
            ></video>
            <button
              v-else
              class="video-poster"
              type="button"
              :aria-label="'播放 ' + item.title"
              @click="playVideo(item.id)"
            >
              <span>点击播放</span>
            </button>
          </div>
          <div class="card-body">
            <h2>{{ item.title }}</h2>
          </div>
          <p v-if="item.description">{{ item.description }}</p>
          <div class="media-actions">
            <CommentButton :item="item" type="video" :slug="game.slug" />
            <LikeButton :item="item" type="video" />
          </div>
        </article>
      </div>

      <div v-else class="shot-grid">
        <figure v-for="(item, index) in items" :key="item.id" class="shot">
          <button class="shot-open" type="button" :aria-label="'放大查看 ' + item.title" @click="openPreview(index)">
            <img
              :src="item.thumbnail_path || item.file_path"
              :alt="item.title"
              loading="lazy"
              decoding="async"
            />
          </button>
          <figcaption>
            <div class="shot-meta">
              <strong>{{ item.title }}</strong>
            </div>
            <span v-if="item.description">{{ item.description }}</span>
            <div class="media-actions">
              <CommentButton :item="item" type="screenshot" :slug="game.slug" />
              <LikeButton :item="item" type="screenshot" />
            </div>
          </figcaption>
        </figure>
      </div>

      <nav v-if="totalPages > 1" class="pager" aria-label="分页">
        <button class="ghost" type="button" :disabled="page <= 1 || loading" @click="goPage(page - 1)">
          上一页
        </button>
        <span>第 {{ page }} / {{ totalPages }} 页</span>
        <button class="ghost" type="button" :disabled="page >= totalPages || loading" @click="goPage(page + 1)">
          下一页
        </button>
      </nav>
    </template>

    <div
      v-if="preview"
      class="lightbox"
      role="dialog"
      aria-modal="true"
      :aria-label="preview.title"
      @click.self="closePreview"
    >
      <button class="lightbox-close" type="button" aria-label="关闭" @click="closePreview">×</button>
      <button
        v-if="items.length > 1"
        class="lightbox-nav lightbox-prev"
        type="button"
        aria-label="上一张"
        @click="shiftPreview(-1)"
      >
        ‹
      </button>
      <figure class="lightbox-figure">
        <img :src="preview.file_path" :alt="preview.title" />
        <figcaption>
          <div class="shot-meta">
            <strong>{{ preview.title }}</strong>
          </div>
          <span v-if="preview.description">{{ preview.description }}</span>
          <div class="media-actions">
            <CommentButton :item="preview" type="screenshot" :slug="game.slug" />
            <LikeButton :item="preview" type="screenshot" />
          </div>
        </figcaption>
      </figure>
      <button
        v-if="items.length > 1"
        class="lightbox-nav lightbox-next"
        type="button"
        aria-label="下一张"
        @click="shiftPreview(1)"
      >
        ›
      </button>
    </div>
  </section>
</template>

<script setup>
import { computed, onUnmounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { api } from "../api";
import LikeButton from "../components/LikeButton.vue";
import CommentButton from "../components/CommentButton.vue";

const props = defineProps({
  kind: { type: String, required: true },
});

const route = useRoute();
const game = ref(null);
const items = ref([]);
const error = ref("");
const loading = ref(false);
const page = ref(1);
const total = ref(0);
const pageSize = ref(12);
const playingId = ref(null);
const previewIndex = ref(-1);
const preview = computed(() =>
  previewIndex.value >= 0 ? items.value[previewIndex.value] || null : null
);
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)));

function playVideo(id) {
  playingId.value = id;
}

function openPreview(index) {
  previewIndex.value = index;
}

function closePreview() {
  previewIndex.value = -1;
}

function shiftPreview(step) {
  const count = items.value.length;
  if (!count) return;
  previewIndex.value = (previewIndex.value + step + count) % count;
}

function goPage(next) {
  page.value = next;
}

function onKeydown(event) {
  if (previewIndex.value < 0) return;
  if (event.key === "Escape") closePreview();
  if (event.key === "ArrowLeft") shiftPreview(-1);
  if (event.key === "ArrowRight") shiftPreview(1);
}

window.addEventListener("keydown", onKeydown);
onUnmounted(() => window.removeEventListener("keydown", onKeydown));

async function load() {
  error.value = "";
  closePreview();
  playingId.value = null;
  loading.value = true;
  const path =
    props.kind === "video"
      ? `/api/games/${route.params.slug}/videos?page=${page.value}&pageSize=8`
      : `/api/games/${route.params.slug}/screenshots?page=${page.value}&pageSize=12`;
  try {
    const data = await api(path);
    game.value = data.game;
    items.value = data.items || [];
    total.value = Number(data.total || 0);
    page.value = Number(data.page || page.value);
    pageSize.value = Number(data.pageSize || pageSize.value);
    document.title = `${data.game.name} · ${props.kind === "video" ? "高光视频" : "高光截图"} · 星穹高光`;
  } catch (err) {
    error.value = err.message;
    items.value = [];
  } finally {
    loading.value = false;
  }
}

watch(
  () => [route.params.slug, props.kind],
  () => {
    if (page.value !== 1) page.value = 1;
    else load();
  }
);

watch(page, load, { immediate: true });
</script>
