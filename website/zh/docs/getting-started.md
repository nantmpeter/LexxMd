---
title: 安装
---

# 快速开始

## 安装

从 [GitHub Releases](https://github.com/nantmpeter/LexxMd/releases/latest) 下载适合你平台的最新版本：

| 平台 | 文件 |
|------|------|
| macOS (Apple Silicon) | `Lexx_x.x.x_aarch64.dmg` |
| macOS (Intel) | `Lexx_x.x.x_x64.dmg` |
| Windows | `Lexx_x.x.x_x64-setup.exe` |
| Linux | `Lexx_x.x.x_amd64.AppImage` |

### macOS

1. 打开 `.dmg` 文件
2. 将 **Lexx** 拖到「应用程序」文件夹
3. 从「应用程序」或 Spotlight 启动

首次启动时，可能需要右键点击并选择「打开」以绕过 Gatekeeper。

### Windows

1. 运行 `.exe` 安装程序
2. 按照安装向导操作
3. 从开始菜单或桌面快捷方式启动

### Linux

1. 赋予执行权限：`chmod +x Lexx_*.AppImage`
2. 运行：`./Lexx_*.AppImage`

## 首次启动

打开 Lexx 后，你会看到一个干净的空编辑器。直接开始输入 Markdown —— 编辑器使用**双模所见即所得**模式，你会在当前光标所在的块中看到语法标记，其他地方则是渲染后的效果。

## 打开文件

有多种方式可以打开文件：

- **菜单**：文件 → 打开（⌘O / Ctrl+O）
- **快速打开**：⌘P / Ctrl+P，其中也会列出最近打开的文件
- **拖拽**：将 `.md` 文件拖拽到 Lexx 的 Dock 图标或窗口上
- **双击**：在系统设置中将 `.md` 文件关联到 Lexx，双击即可打开
- **命令行**：`lexx path/to/file.md`

## 打开文件夹

使用 文件 → 打开文件夹 来打开一个目录作为工作区。侧边栏会显示文件树，方便快速导航。

## 自动保存

Lexx 在你停止输入 3 秒后自动保存工作。状态栏中的圆点指示器会显示未保存的更改。如果文件尚未保存过，内容会存储在临时位置用于崩溃恢复。
