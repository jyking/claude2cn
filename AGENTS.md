# AGENTS.md — claude2cn 翻译规则

本规则适用于本项目所有翻译任务，除非明确覆盖。

## 规则

1. 用 Read 读取文件，用 Write 写回完整文件。键（英文原文）必须逐字符保持不变（含智能引号 ’ “ ” 、省略号等）。
2. 不调用任何外部 API 或网络工具，由你自己直接翻译。
3. 占位符一律保留原样：`{name}`、`{count}`、`{months, plural, one {# month} other {# months}}` 这类 ICU 结构保留语法，只翻译其中人类可读文本（如 `"{count, plural, one {# month} other {# months}}"` → `"{count, plural, one {# 个月} other {# 个月}}"`，`#` 保留）。HTML 类标签 `<b>`、`<bold>`、`<link>`、`<cmd>` 等保留原样。
4. 专有名词不翻译：Claude、Claude Code、Anthropic、GitHub、Git、SSH、MCP、API、SDK、Slack、VS Code、macOS、Linux、Windows、YAML、JSON、URL、React、npm 等。
5. 术语表（与项目既有译文一致）：worktree→工作树、artifact→构件、plugin→插件、skill→技能、slash command→斜杠命令、seat→席位、subagent→子代理、sandbox→沙箱、usage→用量、pull request→拉取请求、commit→提交、model→模型、session→会话、marketplace→市场、agent→代理、effort→思考（如 Max effort→Max 思考级别、effort level→思考级别）。
6. 敬称用「您」；标点用全角（，。（）“”）；括号内容用全角（）。
7. 输出必须是合法 JSON，2 空格缩进，键顺序不变。所有值不得为空。
8. 启动子代理（subagent）不要超过 4 个。
