import DefaultTheme from 'vitepress/theme'
import './custom.css'
import GiscusComment from './components/GiscusComment.vue'
import WebGLCanvas from './components/WebGLCanvas.vue'
import { useRoute, useData } from 'vitepress'
import { h } from 'vue'

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'doc-after': () => {
        const route = useRoute()
        const { frontmatter } = useData()
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
