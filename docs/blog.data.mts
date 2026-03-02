import { createContentLoader } from 'vitepress'

export default createContentLoader('blog/*.md', {
  transform(rawData) {
    return rawData
      .filter(page => !page.url.endsWith('/blog/'))
      .sort((a, b) => +new Date(b.frontmatter.date) - +new Date(a.frontmatter.date))
      .map(page => ({
        title: page.frontmatter.title,
        description: page.frontmatter.description,
        date: page.frontmatter.date,
        tag: page.frontmatter.tag,
        url: page.url,
      }))
  },
})
