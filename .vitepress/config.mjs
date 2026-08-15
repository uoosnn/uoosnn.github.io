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
    // 다국어 브라우저 감지 및 자동 리다이렉트 스크립트 (KO, JA, EN - PageSpeed / Lighthouse 봇 예외 처리 포함)
    ['script', {}, `
      (function() {
        if (typeof window === 'undefined' || typeof localStorage === 'undefined' || typeof navigator === 'undefined') return;
        
        /* 0. 검색엔진 봇 및 성능 측정 도구(PageSpeed/Lighthouse) 예외 처리: 봇은 리다이렉트 없이 원본 페이지를 즉시 수집/측정 */
        var isBot = /bot|googlebot|crawler|spider|robot|crawling|lighthouse|pagespeed|pingdom|gtmetrix|bytespider/i.test(navigator.userAgent);
        if (isBot) return;
        var path = window.location.pathname;
        var ref = document.referrer || '';
        var host = window.location.host;

        /* 1. 현재 접속 경로 및 이전 페이지(Referrer)를 통해 사용자가 선택한 언어 감지 및 저장 */
        if (path.startsWith('/ja/') || path === '/ja' || path === '/ja/') {
          localStorage.setItem('user_pref_lang', 'ja');
          return;
        } else if (path.startsWith('/en/') || path === '/en' || path === '/en/') {
          localStorage.setItem('user_pref_lang', 'en');
          return;
        } else if (ref.indexOf(host) !== -1 && (ref.indexOf('/ja/') !== -1 || ref.indexOf('/en/') !== -1)) {
          /* JA나 EN 페이지에서 KO(기본) 페이지로 수동 이동한 경우 -> 한국어 선택으로 기억 */
          localStorage.setItem('user_pref_lang', 'ko');
        }

        /* 2. 언어 감지 및 저장 (모든 페이지 적용) */
        var targetLang = localStorage.getItem('user_pref_lang');
        if (!targetLang) {
          /* 저장된 기록이 없을 시 브라우저 설정 언어 감지 */
          var browserLang = (navigator.language || navigator.userLanguage || '').toLowerCase();
          if (browserLang.indexOf('ja') === 0) {
            targetLang = 'ja';
          } else if (browserLang.indexOf('ko') === 0) {
            targetLang = 'ko';
          } else {
            targetLang = 'en'; /* KO, JA 외 기타 외국어 접속자는 EN으로 분기 */
          }
          localStorage.setItem('user_pref_lang', targetLang);
        }

        /* 3. 이미 해당 언어 경로에 위치해 있는 경우 불필요한 리다이렉트 방지 */
        if (targetLang === 'ko' && (!path.startsWith('/ja') && !path.startsWith('/en'))) return;
        if (targetLang === 'ja' && (path.startsWith('/ja/') || path === '/ja')) return;
        if (targetLang === 'en' && (path.startsWith('/en/') || path === '/en')) return;

        /* 4. 구글 검색(딥링크) 접속 시에도 해당 언어 페이지로 강제 이동 */
        if (targetLang === 'ja') {
          window.location.replace('/ja' + (path === '/' ? '/' : path));
        } else if (targetLang === 'en') {
          window.location.replace('/en' + (path === '/' ? '/' : path));
        }
      })();
    `],
  ],

  // sitemap 자동 생성 (Google Search Console 등록용)
  sitemap: {
    hostname: 'https://uoosnn.github.io'
  },

  // 모든 페이지 빌드 시 SEO 메타 태그(Canonical, Hreflang) 자동 주입
  transformPageData(pageData) {
    const route = pageData.relativePath.replace(/index\.md$/, '').replace(/\.md$/, '');
    const canonicalUrl = `https://uoosnn.github.io/${route}`;
    pageData.frontmatter.head ??= [];
    
    // Canonical URL
    pageData.frontmatter.head.push(['link', { rel: 'canonical', href: canonicalUrl }]);
    
    // Hreflang Tags
    const baseRoute = route.replace(/^(en\/|ja\/)/, '');
    pageData.frontmatter.head.push(['link', { rel: 'alternate', hreflang: 'ko', href: `https://uoosnn.github.io/${baseRoute}` }]);
    pageData.frontmatter.head.push(['link', { rel: 'alternate', hreflang: 'en', href: `https://uoosnn.github.io/en/${baseRoute}` }]);
    pageData.frontmatter.head.push(['link', { rel: 'alternate', hreflang: 'ja', href: `https://uoosnn.github.io/ja/${baseRoute}` }]);
    pageData.frontmatter.head.push(['link', { rel: 'alternate', hreflang: 'x-default', href: `https://uoosnn.github.io/${baseRoute}` }]);
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

