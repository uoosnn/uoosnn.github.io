import DefaultTheme from 'vitepress/theme'
import './custom.css'
import GiscusComment from './components/GiscusComment.vue'
import WebGLCanvas from './components/WebGLCanvas.vue'
import { useRoute, useData } from 'vitepress'
import { h, watch, onMounted, nextTick } from 'vue'

export default {
  extends: DefaultTheme,
  Layout() {
    const route = useRoute()
    const { frontmatter } = useData()

    const updateLandmark = () => {
      if (typeof document === 'undefined') return
      nextTick(() => {
        const vpContent = document.getElementById('VPContent')
        if (vpContent) {
          const isHome = frontmatter.value.layout === 'home'
          const isNotFound = !!document.querySelector('.NotFound')
          if (isHome || isNotFound) {
            vpContent.setAttribute('role', 'main')
            vpContent.setAttribute('aria-label', '메인 콘텐츠')
          } else {
            vpContent.removeAttribute('role')
            vpContent.removeAttribute('aria-label')
          }
        }
        // 테마 전환 스위치 버튼 및 SkipLink 접근성 이름(aria-label) 보정
        document.querySelectorAll('.VPSwitchAppearance').forEach(btn => {
          if (!btn.getAttribute('aria-label')) {
            btn.setAttribute('aria-label', '테마 전환 (다크모드/라이트모드)')
          }
        })
        const skipLink = document.querySelector('.VPSkipLink')
        if (skipLink && !skipLink.getAttribute('aria-label')) {
          skipLink.setAttribute('aria-label', '본문 콘텐츠로 바로가기')
        }
      })
    }

    onMounted(updateLandmark)
    watch(() => route.path, updateLandmark)

    return h(DefaultTheme.Layout, null, {
      'doc-after': () => {
        // /blog/ 또는 /tech/ 하위 게시글에서만 표시 (index.md 제외)
        const isBlogOrTech = (route.path.includes('/blog/') || route.path.includes('/tech/')) &&
                             !route.path.endsWith('/blog/') &&
                             !route.path.endsWith('/tech/')
        // frontmatter에서 comment: false로 비활성화 가능
        const commentEnabled = frontmatter.value.comment !== false
        if (isBlogOrTech && commentEnabled) {
          return h(GiscusComment)
        }
        return null
      }
    })
  },
  enhanceApp({ app }) {
    app.component('WebGLCanvas', WebGLCanvas)
  }
}

