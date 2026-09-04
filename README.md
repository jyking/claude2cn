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

## 安装为浏览器扩展（Edge / Chrome）

本项目同时是一份 **Manifest V3 扩展**,无需脚本管理器,直接复用仓库内的 `.user.js`(用户脚本元数据块本就是 JS 注释,可被 content script 直接加载)。

### 本地加载(开发)

1. 打开 `edge://extensions`(Chrome 为 `chrome://extensions`)
2. 右下角开启「开发人员模式 / Developer mode」
3. 点击「加载解压缩的扩展 / Load unpacked」
4. 选择**本仓库根目录**
5. 访问 https://claude.ai/ ,界面应变为中文,右上角出现用量小部件

DevTools Console 应出现:`✅ Claude 用量监控小部件已启动`

### 打包上架(Microsoft Edge Add-ons / Chrome Web Store)

```sh
zip -r claude2cn-ext-v1.8.4.zip manifest.json claude2cn.user.js claude2cn-design.user.js \
  claude2cn-translations-1.user.js claude2cn-translations-2.user.js \
  claude2cn-translations-3.user.js claude2cn-translations-4.user.js icons
```

要求:zip 根为 `manifest.json`(不要把整个目录打包进去)。Edge 上传到 [partner.microsoft.com](https://partner.microsoft.com/dashboard/microsoftedge/),Chrome 上传到 [chrome.google.com/webstore/devconsole](https://chrome.google.com/webstore/devconsole)。

### 权限说明

零额外权限:不声明 `permissions` / `host_permissions`。扩展仅在 `https://claude.ai/*` 注入内容脚本,所有网络请求复用页面自身身份同源发起,适合商店审核。

### 词库远程兜底（自动热更新）

翻译词库拆为 3 个分片 + 1 个 extra 覆盖层(见下「项目结构」)。词库高频变动,走商店审核 + 用户手动更新延迟很大,因此扩展内置了**远程兜底**机制:

- 扩展启动时**先用打包的 4 个文件**立即可用(离线基线,远程失败不影响使用)。
- 后台每 6h 至多一次并行拉取 GitHub raw 上的最新 4 个词库文件,对拼接结果计算 SHA-256。
- **内容有变则热替换**全局 `TRANSLATIONS`——无需 bump 版本号,只要任一文件内容变就触发;fetch hook 与 DOM 翻译均按需读取全局,下一次调用即生效。
- 该机制**仅在浏览器扩展环境**运行(检测到 `GM_info` 不存在);油猴用户由 `@require`(GitHub raw)随脚本管理器更新,不会重复拉取。
- 远程源:`https://raw.githubusercontent.com/jyking/claude2cn/main/claude2cn-translations-{1,2,3,extra}.user.js`(该域返回 `Access-Control-Allow-Origin: *`,可从 claude.ai 源直接读取)。

> 因此:你 push 新词库后,扩展用户在 6h 内 + 一次页面重载即可拿到最新翻译,**无需重新发版扩展**。Design 词库与主脚本逻辑仍随扩展版本更新。

### 维护词库

- 翻译源数据在 `en2cn.json`(英文 → 中文)。运行 `bun run sort_json.ts` 会:排序 `en2cn.json` → 按字母序均分成 3 个分片文件 → 同步各文件 `@version`。
- **新增/覆盖词条**请写在 `claude2cn-translations-4.user.js`(手动维护,构建只在缺失时建空模板、已存在仅同步版本号,**绝不覆盖内容**)。它在 1/2/3 之后加载,优先级最高。
- 油猴 `@require` 已切到 GitHub raw 直链(4 条),无需在 GreasyFork 发布即可生效;如需走 GreasyFork,自行替换 `claude2cn.user.js` 顶部 4 条 `@require` 为已发布脚本地址。

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
├── claude2cn.user.js                    # 核心油猴脚本（翻译引擎 + 用量面板 + 远程兜底）
├── claude2cn-translations-1.user.js     # 主词库 TRANSLATIONS 分片 1/3（由 en2cn.json 生成）
├── claude2cn-translations-2.user.js     # 主词库 TRANSLATIONS 分片 2/3
├── claude2cn-translations-3.user.js     # 主词库 TRANSLATIONS 分片 3/3
├── claude2cn-translations-4.user.js # 新增/覆盖层（手动维护，优先级最高，构建不覆盖）
├── claude2cn-design.user.js             # Design 页面词库 DESIGN_TRANSLATIONS
├── manifest.json                        # Edge / Chrome MV3 扩展清单（复用上述 .user.js）
├── icons/                               # 扩展图标 16/48/128 PNG
├── en2cn.json            # 翻译映射表（英文 → 中文），词库源数据
├── en.json               # 原始英文 key 列表
├── sort_json.ts          # 排序 en2cn.json → 生成 3 分片 + 管理 extra
├── split_json.ts         # 通用 JSON 拆分/合并工具
└── update_en.ts          # 从 Claude.ai 更新英文 key 的工具
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
