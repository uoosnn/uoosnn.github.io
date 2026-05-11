import { defineConfig } from 'vitepress'
import fs from 'fs'
import path from 'path'

function getBlogSidebar() {
  const blogDir = path.resolve('./blog')
  if (!fs.existsSync(blogDir)) return []
  
  const files = fs.readdirSync(blogDir).filter(file => file.endsWith('.md') && file !== 'index.md')
  
  // 프론트매터의 date 기준으로 내림차순 정렬 (최신 글이 먼저 오도록)
  const sortedFiles = files.map(file => {
    const filePath = path.join(blogDir, file)
    const content = fs.readFileSync(filePath, 'utf-8')
    let time = 0
    
    const dateMatch = content.match(/date:\s*([^\n]+)/)
    if (dateMatch && dateMatch[1]) {
      const parsedTime = new Date(dateMatch[1].trim()).getTime()
      if (!isNaN(parsedTime)) {
        time = parsedTime
      }
    }
    
    const stat = fs.statSync(filePath)
    
    // date 필드가 없거나 파싱 실패 시 파일 생성/수정 시간으로 대체
    if (!time) {
      time = stat.mtimeMs
    }
    
    return { file, time, mtimeMs: stat.mtimeMs }
  }).sort((a, b) => {
    if (b.time !== a.time) return b.time - a.time
    return b.mtimeMs - a.mtimeMs
  }).map(item => item.file)
  
  return sortedFiles.map(file => {
    const name = file.replace(/\.md$/, '')
    return { text: name, link: `/blog/${name}` }
  })
}

export default defineConfig({
  title: "Uoosnn",
  description: "Software Engineer Portfolio & Blog",
  head: [['link', { rel: 'icon', href: '/favicon.ico' }]],
  
  // 다국어 설정
  locales: {
    root: {
      label: '🇰🇷 KO',
      lang: 'ko',
      themeConfig: {
        nav: [
          { text: 'Home', link: '/' },
          { text: 'Resume', link: '/resume' },
          { text: 'Blog', link: '/blog/' }
        ],
        sidebar: {
          '/blog/': [
            {
              text: 'Recent Posts',
              items: [
                ...getBlogSidebar()
              ]
            }
          ]
        }
      }
    },
    en: {
      label: '🇺🇸 EN',
      lang: 'en',
      link: '/en/',
      themeConfig: {
        nav: [
          { text: 'Home', link: '/en/' },
          { text: 'Resume', link: '/en/resume' },
          { text: 'Blog', link: '/blog/' }
        ],
        sidebar: {
          '/blog/': [
            {
              text: 'Recent Posts',
              items: [
                ...getBlogSidebar()
              ]
            }
          ]
        }
      }
    },
    ja: {
      label: '🇯🇵 JP',
      lang: 'ja',
      link: '/ja/',
      themeConfig: {
        nav: [
          { text: 'Home', link: '/ja/' },
          { text: 'Resume', link: '/ja/resume' },
          { text: 'Blog', link: '/blog/' }
        ],
        sidebar: {
          '/blog/': [
            {
              text: 'Recent Posts',
              items: [
                ...getBlogSidebar()
              ]
            }
          ]
        }
      }
    }
  },

  themeConfig: {
    socialLinks: [
      { icon: 'github', link: 'https://github.com/uoosnn' }
    ],
    footer: {
      message: 'Built with VitePress.',
      copyright: 'Copyright © 2026 Uoosnn'
    }
  }
})
