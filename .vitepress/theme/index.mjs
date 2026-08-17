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
        if (!vpContent) return
        const isHome = frontmatter.value.layout === 'home'
        const isNotFound = !!document.querySelector('.NotFound')
        if (isHome || isNotFound) {
          vpContent.setAttribute('role', 'main')
          vpContent.setAttribute('aria-label', '메인 콘텐츠')
        } else {
          vpContent.removeAttribute('role')
          vpContent.removeAttribute('aria-label')
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

