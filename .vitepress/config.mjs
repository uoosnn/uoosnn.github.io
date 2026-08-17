import { defineConfig, createContentLoader } from 'vitepress'
import { Feed } from 'feed'
import { writeFileSync, mkdirSync } from 'fs'
import fs from 'fs'
import path from 'path'

const SITE_URL = 'https://www.uoosnn.com'


/**
 * 지정된 디렉토리에서 블로그 사이드바 목록을 생성합니다.
 * @param {string} dir - 블로그 마크다운 파일이 있는 디렉토리 (예: './blog', './en/blog')
 * @param {string} urlPrefix - URL 경로 접두사 (예: '/blog', '/en/blog')
 */
function getBlogSidebar(dir = './blog', urlPrefix = '/blog') {
  const blogDir = path.resolve(dir)
  if (!fs.existsSync(blogDir)) return []

  const files = fs.readdirSync(blogDir).filter(file => file.endsWith('.md') && file !== 'index.md')

  const sortedItems = files.map(file => {
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

    // 마크다운 프론트매터(title:) 또는 첫 번째 H1(# 제목)에서 글 제목 추출
    let title = ''
    const titleMatch = content.match(/^title:\s*["']?([^"'\n]+)["']?/m)
    if (titleMatch && titleMatch[1]) {
      title = titleMatch[1].trim()
    } else {
      const h1Match = content.match(/^#\s+(.+)$/m)
      if (h1Match && h1Match[1]) {
        title = h1Match[1].trim()
      } else {
        title = file.replace(/\.md$/, '')
      }
    }

    const stat = fs.statSync(filePath)
    if (!time) {
      time = stat.mtimeMs
    }

    const name = file.replace(/\.md$/, '')

    return { file, name, title, time, mtimeMs: stat.mtimeMs }
  }).sort((a, b) => {
    if (b.time !== a.time) return b.time - a.time
    return b.mtimeMs - a.mtimeMs
  })

  return sortedItems.map(item => {
    return { text: item.title, link: `${urlPrefix}/${item.name}` }
  })
}

/**
 * VitePress 빌드 완료 후 3개 언어별 RSS 피드를 자동 생성합니다.
 */
async function generateRSSFeed(config) {
  const feedConfigs = [
    { pattern: 'blog/*.md', lang: 'ko', prefix: '', title: 'Uoosnn Blog' },
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
    console.log(`✅ RSS 피드 생성 완료: ${prefix}/feed.xml`)
  }
}

export default defineConfig({
  title: "Uoosnn",
  description: "Software Engineer Portfolio & Blog",
  cleanUrls: true,
  head: [
    ['link', { rel: 'icon', href: '/favicon.ico' }],
    ['link', { rel: 'alternate', type: 'application/rss+xml', title: 'Uoosnn Blog RSS', href: '/feed.xml' }],
    // HTTP 요청을 자동으로 HTTPS로 승격 (Lighthouse / PageSpeed HTTPS 최적화)
    ['meta', { 'http-equiv': 'Content-Security-Policy', content: 'upgrade-insecure-requests' }],
    // HTTP 접속 사용자를 강제로 HTTPS로 리디렉션 (로컬 개발 환경 제외)
    ['script', {}, `
      if (typeof window !== 'undefined' && window.location.protocol === 'http:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        window.location.replace('https://' + window.location.hostname + window.location.pathname + window.location.search + window.location.hash);
      }
    `],
    // 외부 서비스 사전 연결 (Preconnect & DNS Prefetch)
    ['link', { rel: 'preconnect', href: 'https://www.googletagmanager.com' }],
    ['link', { rel: 'preconnect', href: 'https://giscus.app' }],
    ['link', { rel: 'dns-prefetch', href: 'https://www.googletagmanager.com' }],
    ['link', { rel: 'dns-prefetch', href: 'https://giscus.app' }],
    // Google Analytics (GA4) - 사용자 상호작용 또는 5초 후 비동기 지연 로딩 (TBT 완전 제거)
    ['script', {}, `
      (function() {
        function loadGA() {
          if (window.gaLoaded) return;
          window.gaLoaded = true;
          var s = document.createElement('script');
          s.async = true;
          s.src = 'https://www.googletagmanager.com/gtag/js?id=G-Y22Y38DLKM';
          document.head.appendChild(s);
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-Y22Y38DLKM');
        }
        var events = ['mousemove', 'touchstart', 'scroll', 'keydown'];
        function triggerGA() {
          loadGA();
          events.forEach(function(e) { window.removeEventListener(e, triggerGA); });
        }
        events.forEach(function(e) { window.addEventListener(e, triggerGA, { passive: true }); });
        setTimeout(loadGA, 5000);
      })();
    `],
    // Google AI Overview (AI 개요) 및 검색엔진용 JSON-LD 구조화 데이터 (Schema.org)
    ['script', { type: 'application/ld+json' }, JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      'name': 'Uoosnn Blog',
      'url': 'https://www.uoosnn.com',
      'inLanguage': ['ko', 'en', 'ja'],
      'author': {
        '@type': 'Person',
        'name': 'Uoosnn'
      }
    })]
  ],

  // sitemap 자동 생성 (Google Search Console 등록용)
  sitemap: {
    hostname: SITE_URL
  },

  // 모든 페이지 빌드 시 SEO 메타 태그(Canonical, Hreflang) 자동 주입
  transformPageData(pageData) {
    const route = pageData.relativePath.replace(/index\.md$/, '').replace(/\.md$/, '');
    const canonicalUrl = `${SITE_URL}/${route}`;
    pageData.frontmatter.head ??= [];
    
    // Canonical URL
    pageData.frontmatter.head.push(['link', { rel: 'canonical', href: canonicalUrl }]);
    
    // Hreflang Tags
    const baseRoute = route.replace(/^(en\/|ja\/)/, '');
    pageData.frontmatter.head.push(['link', { rel: 'alternate', hreflang: 'ko', href: `${SITE_URL}/${baseRoute}` }]);
    pageData.frontmatter.head.push(['link', { rel: 'alternate', hreflang: 'en', href: `${SITE_URL}/en/${baseRoute}` }]);
    pageData.frontmatter.head.push(['link', { rel: 'alternate', hreflang: 'ja', href: `${SITE_URL}/ja/${baseRoute}` }]);
    pageData.frontmatter.head.push(['link', { rel: 'alternate', hreflang: 'x-default', href: `${SITE_URL}/${baseRoute}` }]);
  },

  // 홈 및 404 페이지 정적 빌드 시 landmark-one-main 접근성 규격(role="main") 자동 주입
  transformHtml(code, id, { pageData }) {
    const isHome = pageData?.frontmatter?.layout === 'home';
    const isNotFound = id.endsWith('404.html') || code.includes('class="NotFound"') || pageData?.relativePath === '404.md';
    if (isHome) {
      return code.replace(
        /id="VPContent"/g,
        'id="VPContent" role="main" aria-label="메인 콘텐츠"'
      );
    }
    if (isNotFound) {
      return code.replace(
        '<div id="app"></div>',
        '<div id="app" role="main" aria-label="Not Found"></div>'
      );
    }
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
          { text: 'Tech', link: '/tech/' }
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
          { text: 'Tech', link: '/en/tech/' }
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
          { text: 'Tech', link: '/ja/tech/' }
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
      message: 'Built with VitePress. | 📡 <a href="https://uoosnn.github.io/feed.xml" target="_blank" rel="noopener noreferrer" aria-label="Uoosnn Blog RSS 피드 구독">RSS Feed</a>',
      copyright: 'Copyright © 2026 Uoosnn'
    }
  },

  vite: {
    build: {
      minify: 'esbuild',
      chunkSizeWarningLimit: 1000
    }
  }
})

