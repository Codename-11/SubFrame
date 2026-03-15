import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'SubFrame',
  titleTemplate: ':title',
  description: 'Terminal-First IDE for AI Coding Tools',
  base: '/docs/',
  cleanUrls: true,
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/docs/assets/icon.svg' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: 'anonymous' }],
    [
      'link',
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap',
      },
    ],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'SubFrame — Terminal-First IDE for AI Coding Tools' }],
    ['meta', { property: 'og:description', content: 'Terminal-First IDE for AI Coding Tools' }],
    ['meta', { property: 'og:site_name', content: 'SubFrame' }],
    ['meta', { property: 'og:locale', content: 'en_US' }],
    ['meta', { property: 'og:image', content: 'https://sub-frame.dev/og-image.png' }],
    ['meta', { property: 'og:image:width', content: '1200' }],
    ['meta', { property: 'og:image:height', content: '630' }],
    ['meta', { property: 'og:image:type', content: 'image/png' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:title', content: 'SubFrame — Terminal-First IDE for AI Coding Tools' }],
    ['meta', { name: 'twitter:description', content: 'Terminal-First IDE for AI Coding Tools' }],
    ['meta', { name: 'twitter:image', content: 'https://sub-frame.dev/og-image.png' }],
  ],

  sitemap: {
    hostname: 'https://sub-frame.dev',
  },

  transformPageData(pageData) {
    const canonicalUrl = `https://sub-frame.dev/docs/${pageData.relativePath}`
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
      { text: 'Guide', link: '/introduction' },
      { text: 'Reference', link: '/sub-tasks' },
      { text: 'Blog', link: '/blog/' },
      { text: 'GitHub', link: 'https://github.com/Codename-11/SubFrame' },
    ],

    sidebar: {
      '/': [
        {
          text: 'Guide',
          items: [
            { text: 'Introduction', link: '/introduction' },
            { text: 'Getting Started', link: '/getting-started' },
            { text: 'AI Tool Setup', link: '/ai-tool-setup' },
            { text: 'Features Overview', link: '/features' },
          ],
        },
        {
          text: 'Reference',
          items: [
            { text: 'Sub-Tasks', link: '/sub-tasks' },
            { text: 'Hooks & Skills', link: '/hooks-skills' },
            { text: 'Pipeline Workflows', link: '/pipelines' },
            { text: 'Configuration', link: '/configuration' },
            { text: 'Keyboard Shortcuts', link: '/keyboard-shortcuts' },
            { text: 'Troubleshooting', link: '/troubleshooting' },
          ],
        },
      ],
      '/blog/': [
        {
          text: 'Blog',
          items: [
            { text: 'Context Preservation', link: '/blog/context-preservation' },
            { text: 'Multi-AI Support', link: '/blog/multi-ai-support' },
            { text: 'Initialize Workspace', link: '/blog/initialize-workspace' },
            { text: 'SubFrame Server', link: '/blog/subframe-server' },
          ],
        },
      ],
    },
  },
})
