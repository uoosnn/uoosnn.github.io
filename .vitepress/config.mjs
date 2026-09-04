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

    const isDraft = /draft:\s*true/i.test(content)
    if (isDraft) return null

    const name = file.replace(/\.md$/, '')

    return { file, name, title, time, mtimeMs: stat.mtimeMs }
  }).filter(Boolean).sort((a, b) => {
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
      .filter(p => !p.url.endsWith('/blog/') && p.url !== '/blog/' && !p.frontmatter?.draft && p.frontmatter?.draft !== 'true')
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

  // sitemap 자동 생성 (Google Search Console 최적화: lastmod 필수 속성, 갱신주기, 필터링)
  sitemap: {
    hostname: SITE_URL,
    transformItems(items) {
      return items
        .filter(item => {
          const url = item.url;
          return !url.endsWith('/README') && url !== 'README' && !url.includes('404');
        })
        .map(item => {
          const isHome = item.url === '' || item.url === 'ja/' || item.url === 'en/' || item.url === 'ja' || item.url === 'en';
          const isPost = item.url.includes('/blog/') || item.url.includes('/tech/');
          
          // lastmod 속성 추가 (Google Search Console 권장 규격)
          const lastmod = item.lastmod ? new Date(item.lastmod).toISOString() : new Date().toISOString();

          return {
            ...item,
            lastmod,
            changefreq: isHome ? 'daily' : isPost ? 'weekly' : 'monthly',
            priority: isHome ? 1.0 : isPost ? 0.8 : 0.6
          };
        });
    }
  },

  // 모든 페이지 빌드 시 SEO 메타 태그(Canonical, Hreflang, Open Graph, JSON-LD, Noindex) 자동 주입
  transformPageData(pageData) {
    // 1. 경로 정규화 함수 (모든 디렉토리 인덱스에 Trailing Slash 일관 보장)
    const normalizeUrl = (pathStr, isDirectory = false) => {
      const clean = pathStr.replace(/^\/+/, '').replace(/\/+$/, '');
      if (!clean) return `${SITE_URL}/`;

      // 디렉토리 인덱스 여부 확인 (en/tech, ja/blog, tech, blog, en, ja 등)
      const isDir = isDirectory || /^(en\/|ja\/)?(tech|blog)$/.test(clean) || clean === 'en' || clean === 'ja';
      if (isDir) {
        return `${SITE_URL}/${clean}/`;
      }
      return `${SITE_URL}/${encodeURI(clean)}`;
    };

    const isIndex = pageData.relativePath.endsWith('index.md');
    let rawRoute = pageData.relativePath.replace(/index\.md$/, '').replace(/\.md$/, '');
    rawRoute = rawRoute.replace(/\/+$/, '');

    const canonicalUrl = normalizeUrl(rawRoute, isIndex);
    pageData.frontmatter.head ??= [];

    // Canonical URL (표준화 태그 - 301 리디렉션 대상 방지)
    pageData.frontmatter.head.push(['link', { rel: 'canonical', href: canonicalUrl }]);

    // Hreflang 상호 참조 태그 (ko, en, ja, x-default) - 실제 파일 존재 여부 검증
    const baseRoute = rawRoute.replace(/^(en\/|ja\/|en|ja)/, '').replace(/^\/+/, '');
    const isBaseDir = isIndex || /^(tech|blog)$/.test(baseRoute);

    const checkFileExists = (langPrefix) => {
      let targetFile = '';
      if (isIndex) {
        targetFile = langPrefix ? `${langPrefix}/${baseRoute ? baseRoute + '/' : ''}index.md` : (baseRoute ? `${baseRoute}/index.md` : 'index.md');
      } else {
        targetFile = langPrefix ? `${langPrefix}/${baseRoute}.md` : `${baseRoute}.md`;
      }
      return fs.existsSync(path.resolve(targetFile));
    };

    const hasKo = checkFileExists('');
    const hasEn = checkFileExists('en');
    const hasJa = checkFileExists('ja');

    if (hasKo) {
      const koUrl = normalizeUrl(baseRoute, isBaseDir);
      pageData.frontmatter.head.push(['link', { rel: 'alternate', hreflang: 'ko', href: koUrl }]);
      pageData.frontmatter.head.push(['link', { rel: 'alternate', hreflang: 'x-default', href: koUrl }]);
    }
    if (hasEn) {
      const enUrl = normalizeUrl(baseRoute ? `en/${baseRoute}` : 'en', isBaseDir);
      pageData.frontmatter.head.push(['link', { rel: 'alternate', hreflang: 'en', href: enUrl }]);
    }
    if (hasJa) {
      const jaUrl = normalizeUrl(baseRoute ? `ja/${baseRoute}` : 'ja', isBaseDir);
      pageData.frontmatter.head.push(['link', { rel: 'alternate', hreflang: 'ja', href: jaUrl }]);
    }

    // Open Graph & Twitter Cards 메타 태그 주입
    const isPost = /(^|\/)(blog|tech)\/.+/.test(pageData.relativePath) && !pageData.relativePath.endsWith('index.md');
    const pageTitle = pageData.frontmatter.title || pageData.title || 'Uoosnn';
    const pageDesc = pageData.frontmatter.description || pageData.description || 'Software Engineer Portfolio & Blog';
    
    pageData.frontmatter.head.push(['meta', { property: 'og:title', content: pageTitle }]);
    pageData.frontmatter.head.push(['meta', { property: 'og:description', content: pageDesc }]);
    pageData.frontmatter.head.push(['meta', { property: 'og:url', content: canonicalUrl }]);
    pageData.frontmatter.head.push(['meta', { property: 'og:type', content: isPost ? 'article' : 'website' }]);
    pageData.frontmatter.head.push(['meta', { property: 'og:image', content: `${SITE_URL}/favicon.ico` }]);
    pageData.frontmatter.head.push(['meta', { name: 'twitter:card', content: 'summary' }]);
    pageData.frontmatter.head.push(['meta', { name: 'twitter:title', content: pageTitle }]);
    pageData.frontmatter.head.push(['meta', { name: 'twitter:description', content: pageDesc }]);

    // 404, README, draft(초안) 및 noindex 페이지에 robots noindex 자동 주입
    const isDraft = pageData.frontmatter.draft === true || pageData.frontmatter.draft === 'true';
    const isNoIndex = pageData.frontmatter.noindex === true || pageData.frontmatter.noindex === 'true';
    if (pageData.relativePath === '404.md' || pageData.relativePath === 'README.md' || isDraft || isNoIndex) {
      pageData.frontmatter.head.push(['meta', { name: 'robots', content: 'noindex, nofollow' }]);
    }

    // 블로그 및 기술 포스트 개별 항목에 대해 Article / BlogPosting Schema.org JSON-LD 자동 생성
    if (isPost) {
      const title = pageData.frontmatter.title || pageData.title || 'Uoosnn Post';
      const description = pageData.frontmatter.description || pageData.description || title;
      const datePublished = pageData.frontmatter.date ? new Date(pageData.frontmatter.date).toISOString() : new Date().toISOString();
      const lang = pageData.relativePath.startsWith('ja/') ? 'ja-JP' : pageData.relativePath.startsWith('en/') ? 'en-US' : 'ko-KR';

      const jsonLd = {
        '@context': 'https://schema.org',
        '@type': pageData.relativePath.includes('tech') ? 'TechArticle' : 'BlogPosting',
        'headline': title,
        'description': description,
        'url': canonicalUrl,
        'image': `${SITE_URL}/favicon.ico`,
        'inLanguage': lang,
        'datePublished': datePublished,
        'dateModified': datePublished,
        'keywords': pageData.frontmatter.tags ? pageData.frontmatter.tags.join(', ') : 'Tech, Engineering, Cloud',
        'author': {
          '@type': 'Person',
          'name': 'Uoosnn',
          'url': SITE_URL
        },
        'publisher': {
          '@type': 'Organization',
          'name': 'Uoosnn',
          'url': SITE_URL,
          'logo': {
            '@type': 'ImageObject',
            'url': `${SITE_URL}/favicon.ico`
          }
        },
        'mainEntityOfPage': {
          '@type': 'WebPage',
          '@id': canonicalUrl
        }
      };

      pageData.frontmatter.head.push([
        'script',
        { type: 'application/ld+json' },
        JSON.stringify(jsonLd)
      ]);
    }
  },

  // 정적 빌드 시 렌더링 차단 CSS 해제, 버튼 접근성 이름 및 landmark-one-main 주입
  transformHtml(code, id, { pageData }) {
    // 1. vp-icons.css 렌더링 차단(Render-blocking) 해제 - 비동기 로딩
    code = code.replace(
      '<link rel="preload stylesheet" href="/vp-icons.css" as="style">',
      '<link rel="stylesheet" href="/vp-icons.css" media="print" onload="this.media=\'all\'"><noscript><link rel="stylesheet" href="/vp-icons.css"></noscript>'
    );

    // 2. 메인 CSS 로딩 우선순위 상향 (fetchpriority="high")
    code = code.replace(
      /<link rel="preload stylesheet" href="(\/assets\/style\.[^"]+\.css)" as="style">/g,
      '<link rel="preload stylesheet" href="$1" as="style" fetchpriority="high">'
    );

    // 3. 버튼 접근성 이름(aria-label) 주입 (테마 전환 스위치 버튼)
    code = code.replace(
      /class="VPSwitch VPSwitchAppearance"/g,
      'class="VPSwitch VPSwitchAppearance" aria-label="테마 전환 (다크모드/라이트모드)"'
    );

    // 4. Skip to content 바로가기 링크 접근성 이름 주입
    code = code.replace(
      '<a href="#VPContent" class="VPSkipLink visually-hidden"',
      '<a href="#VPContent" class="VPSkipLink visually-hidden" aria-label="본문 콘텐츠로 바로가기"'
    );

    // 5. landmark-one-main 접근성 규격 주입
    const isHome = pageData?.frontmatter?.layout === 'home';
    const isNotFound = id.endsWith('404.html') || code.includes('class="NotFound"') || pageData?.relativePath === '404.md';
    if (isHome) {
      code = code.replace(
        /id="VPContent"/g,
        'id="VPContent" role="main" aria-label="메인 콘텐츠"'
      );
    } else if (isNotFound) {
      code = code.replace(
        '<div id="app"></div>',
        '<div id="app" role="main" aria-label="Not Found"></div>'
      );
    }

    return code;
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
          { text: 'Projects', link: '/projects' },
          { text: 'Blog', link: '/blog/' },
          { text: 'Tech', link: '/tech/' },
          { text: 'Tags', link: '/tags' }
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
          { text: 'Projects', link: '/en/projects' },
          { text: 'Blog', link: '/en/blog/' },
          { text: 'Tech', link: '/en/tech/' },
          { text: 'Tags', link: '/en/tags' }
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
          { text: 'Projects', link: '/ja/projects' },
          { text: 'Blog', link: '/ja/blog/' },
          { text: 'Tech', link: '/ja/tech/' },
          { text: 'Tags', link: '/ja/tags' }
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
      message: 'Built with VitePress. | 📡 <a href="https://www.uoosnn.com/feed.xml" target="_blank" rel="noopener noreferrer" aria-label="Uoosnn Blog RSS 피드 구독">RSS Feed</a>',
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

