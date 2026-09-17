<template>
  <button
    type="button"
    class="like-btn"
    :class="{ liked: item.liked }"
    :disabled="busy"
    :aria-pressed="item.liked ? 'true' : 'false'"
    :aria-label="item.liked ? '取消点赞' : '点赞'"
    @click.stop="onClick"
  >
    <span class="like-icon">{{ item.liked ? "♥" : "♡" }}</span>
    <span>{{ item.like_count || 0 }}</span>
  </button>
</template>

<script setup>
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { api } from "../api";
import { isUserLoggedIn } from "../stores/user";

const props = defineProps({
  item: { type: Object, required: true },
  type: { type: String, required: true },
});

const router = useRouter();
const route = useRoute();
const busy = ref(false);

async function onClick() {
  if (busy.value) return;
  if (!isUserLoggedIn()) {
    router.push({ name: "login", query: { redirect: route.fullPath } });
    return;
  }
  busy.value = true;
  try {
    const data = await api("/api/likes/toggle", {
      method: "POST",
      body: { type: props.type, id: props.item.id },
    });
    props.item.liked = data.liked;
    props.item.like_count = data.likeCount;
  } catch (err) {
    if (err.status === 401) {
      router.push({ name: "login", query: { redirect: route.fullPath } });
    }
  } finally {
    busy.value = false;
  }
}
</script>
