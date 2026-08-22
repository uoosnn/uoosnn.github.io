<template>
  <div v-if="isVisible" class="post-meta-header">
    <div class="post-meta-row">
      <span v-if="formattedDate" class="post-meta-item">
        📅 <strong>{{ formattedDate }}</strong>
      </span>
      <span class="post-meta-item">
        ⏱️ {{ readingTimeText }}
      </span>
      <span v-if="categoryName" class="post-meta-item">
        📁 {{ categoryName }}
      </span>
    </div>
    <div v-if="tags && tags.length > 0" class="post-meta-tags">
      <NotionTag v-for="tag in tags" :key="tag" :tag="tag" />
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, watch } from 'vue'
import { useData, useRoute } from 'vitepress'
import NotionTag from './NotionTag.vue'

const { frontmatter } = useData()
const route = useRoute()

const isVisible = computed(() => {
  const path = route.path
  // /blog/ 또는 /tech/ 하위 개별 게시글에서만 표시 (index.md, tags, projects, resume 제외)
  const isPost = (path.includes('/blog/') || path.includes('/tech/')) &&
                 !path.endsWith('/blog/') &&
                 !path.endsWith('/tech/') &&
                 !path.endsWith('/tags.html') &&
                 !path.endsWith('/projects.html') &&
                 !path.endsWith('/resume.html')
  return isPost && frontmatter.value.layout !== 'home'
})

const categoryName = computed(() => {
  if (route.path.includes('/tech/')) return 'Tech & Architecture'
  if (route.path.includes('/blog/')) return 'Blog & Life'
  return ''
})

const formattedDate = computed(() => {
  if (!frontmatter.value.date) return ''
  try {
    const d = new Date(frontmatter.value.date)
    return d.toISOString().split('T')[0]
  } catch {
    return String(frontmatter.value.date)
  }
})

const tags = computed(() => {
  if (Array.isArray(frontmatter.value.tags)) return frontmatter.value.tags
  return []
})

const wordCount = ref(0)

const updateStats = () => {
  if (typeof document === 'undefined') return
  setTimeout(() => {
    const contentEl = document.querySelector('.vp-doc')
    if (contentEl) {
      const text = contentEl.innerText || ''
      wordCount.value = text.replace(/\s+/g, '').length
    }
  }, 100)
}

onMounted(updateStats)
watch(() => route.path, updateStats)

const readingTimeText = computed(() => {
  const chars = wordCount.value || 1200
  const minutes = Math.max(1, Math.ceil(chars / 500))
  if (route.path.startsWith('/en/')) {
    return `~${minutes} min read`
  } else if (route.path.startsWith('/ja/')) {
    return `約 ${minutes} 分で読めます`
  }
  return `읽는 시간 약 ${minutes}분 (${chars.toLocaleString()}자)`
})
</script>
