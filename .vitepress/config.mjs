import { defineConfig, createContentLoader } from 'vitepress'
import { Feed } from 'feed'
import { writeFileSync, mkdirSync } from 'fs'
import fs from 'fs'
import path from 'path'

const SITE_URL = 'https://uoosnn.github.io'

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

/**
 * VitePress 빌드 완료 후 3개 언어별 RSS 피드를 자동 생성합니다.
 */
async function generateRSSFeed(config) {
  const feedConfigs = [
    { pattern: 'blog/*.md',    lang: 'ko', prefix: '',    title: 'Uoosnn Blog' },
    { pattern: 'en/blog/*.md', lang: 'en', prefix: '/en', title: 'Uoosnn Blog (EN)' },
    { pattern: 'ja/blog/*.md', lang: 'ja', prefix: '/ja', title: 'Uoosnn Blog (JA)' },
  ]

  for (const { pattern, lang, prefix, title } of feedConfigs) {
    const feed = new Feed({
      title,
      description: 'Software Engineer Portfolio & Blog',
      id: `${SITE_URL}${prefix}/`,
      link: `${SITE_URL}${prefix}/`,
      language: lang,
      copyright: 'Copyright © 2026 Uoosnn',
    })

    let posts = []
    try {
      posts = await createContentLoader(pattern, {
        excerpt: true,
        render: true,
      }).load()
    } catch (e) {
      console.warn(`RSS: ${pattern} 로드 실패, 건너뜁니다.`)
      continue
    }

    posts
      .filter(p => !p.url.endsWith('/blog/') && p.url !== '/blog/')
      .sort((a, b) => +new Date(b.frontmatter?.date || 0) - +new Date(a.frontmatter?.date || 0))
      .forEach(({ url, frontmatter, html }) => {
        feed.addItem({
          title: frontmatter?.title || url,
          id: `${SITE_URL}${url}`,
          link: `${SITE_URL}${url}`,
          content: html || '',
          date: new Date(frontmatter?.date || Date.now()),
        })
      })

    const outDir = prefix
      ? path.join(config.outDir, prefix)
      : config.outDir
    mkdirSync(outDir, { recursive: true })
    writeFileSync(path.join(outDir, 'feed.xml'), feed.rss2())
    console.log(`✅ RSS 피드 생성 완료: ${prefix || '/'}/feed.xml`)
  }
}

export default defineConfig({
  title: "Uoosnn",
  description: "Software Engineer Portfolio & Blog",
  cleanUrls: true,
  head: [
    ['link', { rel: 'icon', href: '/favicon.ico' }],
    ['link', { rel: 'alternate', type: 'application/rss+xml', title: 'Uoosnn Blog RSS', href: '/feed.xml' }],
    // Google Analytics (GA4)
    ['script', { async: '', src: 'https://www.googletagmanager.com/gtag/js?id=G-Y22Y38DLKM' }],
    ['script', {}, "window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','G-Y22Y38DLKM');"],
  ],
  
  // sitemap 자동 생성 (Google Search Console 등록용)
  sitemap: {
    hostname: 'https://uoosnn.github.io'
  },
  
  // 빌드 완료 후 RSS 피드 생성
  buildEnd: generateRSSFeed,
  
  // 다국어 설정
  locales: {
    root: {
      label: '🇰🇷 KO',
      lang: 'ko',
      themeConfig: {
        nav: [
          { text: 'Home', link: '/' },
          { text: 'Resume', link: '/resume' },
          { text: 'Blog', link: '/blog/' },
          { text: 'Tech', link: '/tech/' },
          { text: 'WebGL', link: '/webgl/' }
        ],
        sidebar: {
          '/blog/': [
            {
              text: 'Recent Posts',
              items: [
                ...getBlogSidebar('./blog', '/blog')
              ]
            }
          ],
          '/tech/': [
            {
              text: 'Technical Articles',
              items: [
                ...getBlogSidebar('./tech', '/tech')
              ]
            }
          ],
          '/webgl/': [
            {
              text: 'WebGL Practice',
              items: [
                ...getBlogSidebar('./webgl', '/webgl')
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
          { text: 'Blog', link: '/en/blog/' },
          { text: 'Tech', link: '/en/tech/' },
          { text: 'WebGL', link: '/en/webgl/' }
        ],
        sidebar: {
          '/en/blog/': [
            {
              text: 'Recent Posts',
              items: [
                ...getBlogSidebar('./en/blog', '/en/blog')
              ]
            }
          ],
          '/en/tech/': [
            {
              text: 'Technical Articles',
              items: [
                ...getBlogSidebar('./en/tech', '/en/tech')
              ]
            }
          ],
          '/en/webgl/': [
            {
              text: 'WebGL Practice',
              items: [
                ...getBlogSidebar('./en/webgl', '/en/webgl')
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
          { text: 'Blog', link: '/ja/blog/' },
          { text: 'Tech', link: '/ja/tech/' },
          { text: 'WebGL', link: '/ja/webgl/' }
        ],
        sidebar: {
          '/ja/blog/': [
            {
              text: 'Recent Posts',
              items: [
                ...getBlogSidebar('./ja/blog', '/ja/blog')
              ]
            }
          ],
          '/ja/tech/': [
            {
              text: 'Technical Articles',
              items: [
                ...getBlogSidebar('./ja/tech', '/ja/tech')
              ]
            }
          ],
          '/ja/webgl/': [
            {
              text: 'WebGL Practice',
              items: [
                ...getBlogSidebar('./ja/webgl', '/ja/webgl')
              ]
            }
          ]
        }
      }
    }
  },

  themeConfig: {
    search: { provider: 'local' },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/uoosnn' }
    ],
    footer: {
      message: 'Built with VitePress. | 📡 <a href="https://uoosnn.github.io/feed.xml" target="_blank">RSS Feed</a>',
      copyright: 'Copyright © 2026 Uoosnn'
    }
  }
})
