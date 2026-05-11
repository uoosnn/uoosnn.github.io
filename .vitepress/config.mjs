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
