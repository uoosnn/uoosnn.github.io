import { createContentLoader } from 'vitepress'

export default createContentLoader(['blog/*.md', 'tech/*.md', 'en/blog/*.md', 'en/tech/*.md', 'ja/blog/*.md', 'ja/tech/*.md'], {
  excerpt: true,
  render: false,
  transform(raw) {
    return raw
      .filter(p => {
        const url = p.url
        const isDraft = p.frontmatter?.draft === true || p.frontmatter?.draft === 'true'
        return !url.endsWith('/') && !url.endsWith('index') && !url.endsWith('index.html') && !isDraft
      })
      .map(p => {
        const title = p.frontmatter?.title || decodeURIComponent(p.url.split('/').pop().replace(/\.html$/, '').replace(/-/g, ' '))
        const date = p.frontmatter?.date ? new Date(p.frontmatter.date).toISOString().split('T')[0] : ''
        const tags = Array.isArray(p.frontmatter?.tags) ? p.frontmatter.tags : []
        const description = p.frontmatter?.description || ''
        const category = p.url.includes('/tech/') ? 'Tech' : 'Blog'
        
        let lang = 'ko'
        if (p.url.startsWith('/en/')) lang = 'en'
        else if (p.url.startsWith('/ja/')) lang = 'ja'

        return {
          title,
          url: p.url,
          date,
          tags,
          description,
          category,
          lang
        }
      })
      .sort((a, b) => {
        const timeA = a.date ? new Date(a.date).getTime() : 0
        const timeB = b.date ? new Date(b.date).getTime() : 0
        return timeB - timeA
      })
  }
})
