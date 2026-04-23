import { defineConfig, type DefaultTheme } from 'vitepress'

export const en = defineConfig({
  lang: 'en',
  description: 'A minimal Stealth UI Markdown editor',

  themeConfig: {
    nav: nav(),
    sidebar: sidebar(),

    editLink: {
      pattern: 'https://github.com/nantmpeter/LexxMd/edit/main/website/:path',
      text: 'Edit this page on GitHub',
    },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024-present Lexx',
    },

    docFooter: {
      prev: 'Previous',
      next: 'Next',
    },

    outline: {
      label: 'On this page',
    },

    lastUpdated: {
      text: 'Updated at',
    },

    returnToTopLabel: 'Return to top',
    sidebarMenuLabel: 'Menu',
    darkModeSwitchLabel: 'Theme',
    lightModeSwitchTitle: 'Switch to light theme',
    darkModeSwitchTitle: 'Switch to dark theme',
  },
})

function nav(): DefaultTheme.NavItem[] {
  return [
    { text: 'Features', link: '/en/features' },
    { text: 'Download', link: '/en/download' },
    { text: 'Docs', link: '/en/docs/getting-started', activeMatch: '/en/docs/' },
  ]
}

function sidebar(): DefaultTheme.Sidebar {
  return {
    '/en/docs/': [
      {
        text: 'Getting Started',
        items: [
          { text: 'Installation', link: '/en/docs/getting-started' },
        ],
      },
      {
        text: 'Editing',
        items: [
          { text: 'Dual-Mode Editor', link: '/en/docs/editing' },
          { text: 'Keyboard Shortcuts', link: '/en/docs/keyboard-shortcuts' },
        ],
      },
      {
        text: 'Features',
        items: [
          { text: 'Export', link: '/en/docs/export' },
          { text: 'Configuration', link: '/en/docs/configuration' },
        ],
      },
    ],
  }
}
