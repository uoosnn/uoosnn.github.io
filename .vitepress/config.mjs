import { defineConfig } from 'vitepress'
import fs from 'fs'
import path from 'path'

function getBlogSidebar() {
  const blogDir = path.resolve('./blog')
  if (!fs.existsSync(blogDir)) return []
  
  const files = fs.readdirSync(blogDir).filter(file => file.endsWith('.md') && file !== 'index.md')
  
  // 수정 시간(mtimeMs) 기준으로 내림차순 정렬 (최신 글이 먼저 오도록)
  const sortedFiles = files.map(file => {
    const stat = fs.statSync(path.join(blogDir, file))
    return { file, time: stat.mtimeMs }
  }).sort((a, b) => b.time - a.time).map(item => item.file)
  
  return sortedFiles.map(file => {
    const name = file.replace(/\.md$/, '')
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
