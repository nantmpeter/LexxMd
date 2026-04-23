import { defineConfig } from 'vitepress'

export const shared = defineConfig({
  title: 'Lexx',
  description: 'A minimal Stealth UI Markdown editor',

  head: [
    ['link', { rel: 'icon', type: 'image/png', href: '/lexx.png' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'Lexx — Stealth UI Markdown Editor' }],
    ['meta', { property: 'og:description', content: 'Write Markdown. See Beauty. Native desktop performance with dual-mode WYSIWYG editing.' }],
    ['meta', { property: 'og:image', content: '/og-image.png' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
  ],

  themeConfig: {
    logo: '/lexx.png',
    siteTitle: 'Lexx',
  },

  lastUpdated: true,
  cleanUrls: true,
})
