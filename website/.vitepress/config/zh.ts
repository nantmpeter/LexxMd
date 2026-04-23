import { defineConfig, type DefaultTheme } from 'vitepress'

export const zh = defineConfig({
  lang: 'zh',
  description: '极简「隐身界面」Markdown 编辑器',

  themeConfig: {
    nav: nav(),
    sidebar: sidebar(),

    editLink: {
      pattern: 'https://github.com/nantmpeter/LexxMd/edit/main/website/:path',
      text: '在 GitHub 上编辑此页',
    },

    footer: {
      message: '基于 MIT 许可发布。',
      copyright: 'Copyright © 2024-present Lexx',
    },

    docFooter: {
      prev: '上一页',
      next: '下一页',
    },

    outline: {
      label: '本页目录',
    },

    lastUpdated: {
      text: '最后更新于',
    },

    returnToTopLabel: '回到顶部',
    sidebarMenuLabel: '菜单',
    darkModeSwitchLabel: '主题',
    lightModeSwitchTitle: '切换到浅色主题',
    darkModeSwitchTitle: '切换到深色主题',
  },
})

function nav(): DefaultTheme.NavItem[] {
  return [
    { text: '特性', link: '/zh/features' },
    { text: '下载', link: '/zh/download' },
    { text: '文档', link: '/zh/docs/getting-started', activeMatch: '/zh/docs/' },
  ]
}

function sidebar(): DefaultTheme.Sidebar {
  return {
    '/zh/docs/': [
      {
        text: '快速开始',
        items: [
          { text: '安装', link: '/zh/docs/getting-started' },
        ],
      },
      {
        text: '编辑',
        items: [
          { text: '双模编辑器', link: '/zh/docs/editing' },
          { text: '快捷键', link: '/zh/docs/keyboard-shortcuts' },
        ],
      },
      {
        text: '功能',
        items: [
          { text: '导出', link: '/zh/docs/export' },
          { text: '配置', link: '/zh/docs/configuration' },
        ],
      },
    ],
  }
}
