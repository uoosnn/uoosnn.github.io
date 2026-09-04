<template>
  <component
    :is="clickable ? 'a' : 'span'"
    :href="clickable ? tagUrl : undefined"
    :rel="clickable ? 'nofollow' : undefined"
    :class="['notion-tag', colorClass]"
  >
    <span class="tag-icon">#</span>
    <span class="tag-text">{{ tag }}</span>
  </component>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vitepress'

const props = defineProps({
  tag: {
    type: String,
    required: true
  },
  clickable: {
    type: Boolean,
    default: true
  }
})

const route = useRoute()

// 태그 이름에 따른 노션 컬러 클래스 매핑
const colorClass = computed(() => {
  const t = props.tag.toLowerCase()
  
  if (t.includes('aws') || t.includes('cloud') || t.includes('network') || t.includes('linux') || t.includes('infra') || t.includes('rds')) {
    return 'notion-tag-blue'
  }
  if (t.includes('troubleshoot') || t.includes('성능') || t.includes('performance') || t.includes('automation') || t.includes('최적화')) {
    return 'notion-tag-green'
  }
  if (t.includes('security') || t.includes('cve') || t.includes('incident') || t.includes('침해') || t.includes('보안') || t.includes('backup')) {
    return 'notion-tag-red'
  }
  if (t.includes('serverless') || t.includes('lambda') || t.includes('ai') || t.includes('gemini') || t.includes('telegram') || t.includes('architecture')) {
    return 'notion-tag-purple'
  }
  if (t.includes('windows') || t.includes('wsl') || t.includes('sql') || t.includes('mysql') || t.includes('database') || t.includes('db')) {
    return 'notion-tag-yellow'
  }
  return 'notion-tag-gray'
})

const tagUrl = computed(() => {
  let prefix = ''
  if (route.path.startsWith('/en/')) prefix = '/en'
  else if (route.path.startsWith('/ja/')) prefix = '/ja'
  return `${prefix}/tags?tag=${encodeURIComponent(props.tag)}`
})
</script>

<style scoped>
.tag-icon {
  opacity: 0.6;
  font-weight: 400;
}
.tag-text {
  font-weight: 500;
}
</style>
