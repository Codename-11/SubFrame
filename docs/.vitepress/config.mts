import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'SubFrame',
  titleTemplate: ':title',
  description: 'Terminal-First IDE for AI Coding Tools',
  cleanUrls: true,
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/assets/icon.svg' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: 'anonymous' }],
    [
      'link',
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap',
      },
    ],
    ['meta', { property: 'og:site_name', content: 'SubFrame' }],
    ['meta', { property: 'og:locale', content: 'en_US' }],
    /* TODO: create og-image.png 1200x630 */
    ['meta', { property: 'og:image', content: 'https://sub-frame.dev/assets/og-image.png' }],
    ['meta', { name: 'twitter:image', content: 'https://sub-frame.dev/assets/og-image.png' }],
  ],

  sitemap: {
    hostname: 'https://sub-frame.dev',
  },

  transformPageData(pageData) {
    const canonicalUrl = `https://sub-frame.dev/${pageData.relativePath}`
      .replace(/index\.md$/, '')
      .replace(/\.md$/, '')

    pageData.frontmatter.head ??= []
    pageData.frontmatter.head.push(
      ['link', { rel: 'canonical', href: canonicalUrl }],
      ['meta', { property: 'og:url', content: canonicalUrl }],
    )

    if (pageData.frontmatter.description) {
      pageData.frontmatter.head.push(
        ['meta', { property: 'og:description', content: pageData.frontmatter.description }],
      )
    }
    if (pageData.frontmatter.title) {
      pageData.frontmatter.head.push(
        ['meta', { property: 'og:title', content: pageData.frontmatter.title }],
      )
    }
  },

  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/' },
      { text: 'Blog', link: '/blog/' },
      { text: 'GitHub', link: 'https://github.com/Codename-11/SubFrame' },
    ],

    sidebar: {
      '/guide/': [
        { text: 'Getting Started', link: '/guide/' },
        { text: 'Features', link: '/guide/features' },
        { text: 'Keyboard Shortcuts', link: '/guide/keyboard-shortcuts' },
        { text: 'Configuration', link: '/guide/configuration' },
        { text: 'AI Tool Setup', link: '/guide/ai-tool-setup' },
        { text: 'Troubleshooting', link: '/guide/troubleshooting' },
      ],
    },
  },
})
