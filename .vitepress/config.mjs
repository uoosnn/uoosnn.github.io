import { defineConfig } from 'vitepress'
import fs from 'fs'
import path from 'path'

function getBlogSidebar() {
  const blogDir = path.resolve('./blog')
  if (!fs.existsSync(blogDir)) return []
  
  const files = fs.readdirSync(blogDir).filter(file => file.endsWith('.md') && file !== 'index.md')
  
  return files.map(file => {
    // 파일명에서 확장자 제거
    const name = file.replace(/\.md$/, '')
    // 파일 내용을 읽어서 title 추출 시도 (선택적)
    // 여기서는 간단히 파일명을 그대로 노출
    return { text: name, link: `/blog/${name}` }
  })
}

export default defineConfig({
  title: "Uoosnn",
  description: "Software Engineer Portfolio & Blog",
  head: [['link', { rel: 'icon', href: '/favicon.ico' }]],
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Resume', link: '/resume' },
      { text: 'Blog', link: '/blog/' },
      { text: '니케 공지사항', link: '/nikke-notice/' }
    ],

    sidebar: {
      '/blog/': [
        {
          text: 'Recent Posts',
          items: [
            { text: '첫 번째 글', link: '/blog/hello-world' },
            ...getBlogSidebar()
          ]
        }
      ],
      '/nikke-notice/': [
        {
          text: '공지사항 목록',
          items: [
            { text: '신규 업데이트 안내', link: '/nikke-notice/sample-notice' }
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/uoosnn' }
    ],
    
    footer: {
      message: 'Built with VitePress.',
      copyright: 'Copyright © 2026 Uoosnn'
    }
  }
})
