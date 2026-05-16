<script setup>
import { ref, onMounted, watch, nextTick } from 'vue'
import { useData, useRoute } from 'vitepress'

const { isDark, lang } = useData()
const route = useRoute()
const container = ref(null)

// VitePress lang → Giscus lang 매핑
const giscusLangMap = { ko: 'ko', en: 'en', ja: 'ja' }

function loadGiscus() {
  if (!container.value) return
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

onMounted(() => loadGiscus())

// 페이지 이동 시 Giscus 갱신
watch(() => route.path, () => nextTick(() => loadGiscus()))

// 다크모드 전환 시 Giscus 테마 실시간 동기화
watch(isDark, () => {
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
  <div ref="container" class="giscus-container" />
</template>

<style scoped>
.giscus-container {
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px solid var(--vp-c-divider);
}
</style>
