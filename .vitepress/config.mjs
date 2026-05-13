import { defineConfig } from 'vitepress'
import fs from 'fs'
import path from 'path'

/**
 * 지정된 디렉토리에서 블로그 사이드바 목록을 생성합니다.
 * @param {string} dir - 블로그 마크다운 파일이 있는 디렉토리 (예: './blog', './en/blog')
 * @param {string} urlPrefix - URL 경로 접두사 (예: '/blog', '/en/blog')
 */
function getBlogSidebar(dir = './blog', urlPrefix = '/blog') {
  const blogDir = path.resolve(dir)
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
    return { text: name, link: `${urlPrefix}/${name}` }
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
                ...getBlogSidebar('./blog', '/blog')
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
          { text: 'Blog', link: '/en/blog/' }
        ],
        sidebar: {
          '/en/blog/': [
            {
              text: 'Recent Posts',
              items: [
                ...getBlogSidebar('./en/blog', '/en/blog')
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
          { text: 'Blog', link: '/ja/blog/' }
        ],
        sidebar: {
          '/ja/blog/': [
            {
              text: 'Recent Posts',
              items: [
                ...getBlogSidebar('./ja/blog', '/ja/blog')
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
