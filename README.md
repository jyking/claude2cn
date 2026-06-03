# Claude2CN — Claude.ai 中文汉化

> 为 Claude.ai 提供完整中文界面的油猴脚本，支持用量实时显示、暗色模式、移动端适配。

[![GitHub](https://img.shields.io/badge/GitHub-jyking%2Fclaude2cn-blue?logo=github)](https://github.com/jyking/claude2cn)
[![Greasy Fork](https://img.shields.io/badge/Greasy%20Fork-安装脚本-orange)](https://greasyfork.org/zh-CN/scripts/570390)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## 功能特点

- **完整汉化**：覆盖 Claude.ai 全界面，包括 Claude Code、Artifacts、**Claude Design**、Projects、Cowork 等所有功能模块，内置 10,000+ 行翻译词条。
- **用量实时显示**：悬浮面板实时显示 5 小时与 7 日用量占比、套餐名称及重置倒计时。
- **面板可拖动**：用量面板支持鼠标和触摸拖拽，位置自动记忆（桌面端 & iPad）。
- **暗色模式适配**：随系统/页面主题自动切换面板配色。
- **移动端适配**：响应式布局，手机浏览器下同样可正常使用。
- **轻量高性能**：仅拦截 i18n 接口，不注入额外框架，不影响页面加载。
- **持续更新**：紧跟 Claude.ai 版本迭代，新功能上线即补充翻译。

---

## 安装方法

### 第一步：安装脚本管理器

在浏览器中安装油猴（用户脚本管理器）扩展：

| 扩展 | Chrome / Edge | Firefox | Safari |
|------|--------------|---------|--------|
| [Tampermonkey（油猴）](https://www.tampermonkey.net/) | ✅ | ✅ | ✅ |
| [Violentmonkey（暴力猴）](https://violentmonkey.github.io/) | ✅ | ✅ | — |

### 第二步：安装脚本

**方式 A — 通过 Greasy Fork 一键安装（推荐）**

点击下方链接，在 Greasy Fork 页面点击「安装此脚本」：

👉 **[https://greasyfork.org/zh-CN/scripts/570390-claude-570390-claude-中文汉化-用量显示-claude-ai](https://greasyfork.org/zh-CN/scripts/570390-claude-%E4%B8%AD%E6%96%87%E6%B1%89%E5%8C%96-%E7%94%A8%E9%87%8F%E6%98%BE%E7%A4%BA-claude-ai)**

**方式 B — 通过 GitHub Raw 安装**

在脚本管理器中选择「从 URL 安装」，粘贴：

```
https://raw.githubusercontent.com/jyking/claude2cn/main/claude2cn.user.js
```

**方式 C — 手动安装**

1. 下载本仓库中的 [`claude2cn.user.js`](https://github.com/jyking/claude2cn/raw/main/claude2cn.user.js) 文件。
2. 在脚本管理器中选择「创建新脚本」，将文件内容粘贴进去保存。

### 第三步：刷新页面

访问 [claude.ai](https://claude.ai/)，脚本自动生效。如未生效，请硬刷新（Ctrl+Shift+R / Cmd+Shift+R）。

---

## 用量面板说明

脚本会在页面右上角显示一个可拖动的用量面板：

- **5h 用量**：当前 5 小时滚动窗口内的用量占比及重置倒计时
- **7d 用量**：当前 7 日滚动窗口内的用量占比及重置倒计时
- 颜色含义：🟢 < 60%　🟡 60–85%　🔴 > 85%
- 面板可拖动到任意位置，刷新后位置保留

---

## 项目地址

| 资源 | 链接 |
|------|------|
| GitHub 仓库 | [github.com/jyking/claude2cn](https://github.com/jyking/claude2cn) |
| Greasy Fork（安装页） | [greasyfork.org/zh-CN/scripts/539526](https://greasyfork.org/zh-CN/scripts/539526) |
| Fork 本仓库 | [github.com/jyking/claude2cn/fork](https://github.com/jyking/claude2cn/fork) |
| 问题反馈 | [github.com/jyking/claude2cn/issues](https://github.com/jyking/claude2cn/issues) |

---

## 项目结构

```
claude2cn/
├── claude2cn.user.js   # 核心油猴脚本（翻译引擎 + 用量面板 + 翻译数据）
├── en2cn.json          # 翻译映射表（英文 → 中文），供维护用
├── en.json             # 原始英文 key 列表
├── sort_json.ts        # 翻译文件按字母排序工具
├── split_json.ts       # 翻译文件拆分辅助工具
└── update_en.ts        # 从 Claude.ai 更新英文 key 的工具
```

---

## 贡献翻译

欢迎 PR 补充或修正翻译！

1. Fork 本仓库
2. 在 `en2cn.json` 中添加或修改翻译键值对
3. 运行 `bun run sort_json.ts` 保持文件有序
4. 提交 PR，说明新增/修正的翻译内容

---

## 许可证

本项目采用 [MIT 许可证](LICENSE) 开源，欢迎自由使用和二次开发。
