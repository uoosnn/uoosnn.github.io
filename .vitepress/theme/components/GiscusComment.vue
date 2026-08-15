<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useData, useRoute } from 'vitepress'

const { isDark, lang } = useData()
const route = useRoute()
const container = ref(null)
const isLoaded = ref(false)
let observer = null

// VitePress lang → Giscus lang 매핑
const giscusLangMap = { ko: 'ko', en: 'en', ja: 'ja' }

function loadGiscus() {
  if (!container.value || isLoaded.value) return
  isLoaded.value = true
  container.value.innerHTML = ''

  const script = document.createElement('script')
  script.src = 'https://giscus.app/client.js'
  script.setAttribute('data-repo', 'uoosnn/uoosnn.github.io')
  script.setAttribute('data-repo-id', 'R_kgDOSZDhsw')
  script.setAttribute('data-category', 'General')
  script.setAttribute('data-category-id', 'DIC_kwDOSZDhs84C9Mry')
  script.setAttribute('data-mapping', 'pathname')
  script.setAttribute('data-strict', '1')
  script.setAttribute('data-reactions-enabled', '1')
  script.setAttribute('data-emit-metadata', '0')
  script.setAttribute('data-input-position', 'bottom')
  script.setAttribute('data-theme', isDark.value ? 'dark' : 'light')
  script.setAttribute('data-lang', giscusLangMap[lang.value] || 'ko')
  script.setAttribute('crossorigin', 'anonymous')
  script.async = true
  container.value.appendChild(script)
}

function initLazyLoad() {
  if (isLoaded.value) return
  if (!container.value) return

  if ('IntersectionObserver' in window) {
    if (observer) observer.disconnect()
    observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        loadGiscus()
        if (observer) observer.disconnect()
      }
    }, { rootMargin: '200px' })
    observer.observe(container.value)
  } else {
    loadGiscus()
  }
}

onMounted(() => {
  initLazyLoad()
})

onUnmounted(() => {
  if (observer) observer.disconnect()
})

// 페이지 이동 시 Giscus 갱신
watch(() => route.path, () => {
  isLoaded.value = false
  nextTick(() => initLazyLoad())
})

// 다크모드 전환 시 Giscus 테마 실시간 동기화
watch(isDark, () => {
  if (!isLoaded.value) return
  const iframe = document.querySelector('iframe.giscus-frame')
  if (iframe) {
    iframe.contentWindow?.postMessage(
      { giscus: { setConfig: { theme: isDark.value ? 'dark' : 'light' } } },
      'https://giscus.app'
    )
  }
})
</script>

<template>
  <div ref="container" class="giscus-container" role="region" aria-label="사용자 댓글 구역" />
</template>

<style scoped>
.giscus-container {
  margin-top: 2rem;
  padding-top: 2rem;
  min-height: 150px;
  border-top: 1px solid var(--vp-c-divider);
}
</style>
