# Claude.ai 中文汉化脚本 (Claude2CN)

本项目提供了一个用于 [Claude.ai](https://claude.ai/) 的界面中文汉化油猴脚本（Userscript），旨在提升中文用户的使用体验。

## 🚀 功能特点

- **深度汉化**：涵盖了 Claude.ai 界面上的大部分交互元素、提示信息、设置选项以及新上线的功能（如 Claude Code, Artifacts 等）。
- **实时更新**：紧随 Claude.ai 的版本迭代，持续补充翻译内容。
- **高性能**：采用轻量级实现，不影响页面加载和运行平衡。
- **大量词汇**：内置 10,000+ 行翻译词条，确保汉化的完整性。

## 📦 安装方法

1. **安装脚本管理器**：
   在浏览器中安装一个用户脚本管理器扩展，推荐使用：
   - [Tampermonkey (油猴)](https://www.tampermonkey.net/)
   - [Violentmonkey (暴力猴)](https://violentmonkey.github.io/)

2. **添加脚本**：
   - 下载本项目中的 `claude2cn.user.js` 文件。
   - 在脚本管理器中选择“添加新脚本”或“导入”，将 `claude2cn.user.js` 的内容粘贴进去或直接加载文件。

3. **刷新页面**：
   访问 [Claude.ai](https://claude.ai/)，脚本将自动生效。

## 🛠️ 项目结构

- `claude2cn.user.js`: 核心油猴脚本，包含翻译引擎和已集成的翻译数据。
- `en2cn.json`: 原始翻译映射文件（英文 -> 中文）。
- `sort_json.ts`: 开发辅助工具，用于对 `en2cn.json` 中的键进行字母顺序排序，方便维护和比对。

## 🛠️ 维护工具

如果你想为项目贡献翻译或自行维护：
- 使用 `sort_json.ts` 保持翻译文件的整洁。
- 确保所有的翻译键值对应。

## 📄 许可证

本项目采用 [MIT 许可证](LICENSE) 开源。
