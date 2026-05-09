import { defineConfig } from 'vitepress'

export default defineConfig({
  title: "Uoosnn",
  description: "Software Engineer Portfolio & Blog",
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
            { text: '첫 번째 글', link: '/blog/hello-world' }
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
