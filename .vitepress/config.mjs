import { defineConfig } from 'vitepress'

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
            { text: '첫 번째 글', link: '/blog/hello-world' }
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
