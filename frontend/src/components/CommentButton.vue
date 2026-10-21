<template>
  <router-link
    class="comment-btn"
    :to="to"
    :aria-label="`查看评论 ${item.comment_count || 0}`"
    @click.stop
  >
    <span class="comment-icon" aria-hidden="true">💬</span>
    <span>{{ item.comment_count || 0 }}</span>
  </router-link>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  item: { type: Object, required: true },
  type: { type: String, required: true },
  slug: { type: String, required: true },
});

const to = computed(() => {
  const kind = props.type === "video" ? "videos" : "screenshots";
  return `/games/${props.slug}/${kind}/${props.item.id}`;
});
</script>
