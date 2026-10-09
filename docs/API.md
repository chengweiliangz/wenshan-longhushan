# API 配置说明

## 当前默认配置（2026-10-07）

- 服务：DeepSeek
- Base URL：`https://api.deepseek.com`
- 模型：`deepseek-flash`
- 格式：OpenAI Chat Completions
- 认证：Authorization Bearer
- 行程、手记和连接测试使用 JSON；道士聊天使用纯文本 SSE 流式。输出上限 1800 Tokens；超时 45 秒。
- DeepSeek 聊天显式关闭 thinking；人格位于 shared/guidePersona.mjs，资料原文及精确事实索引随请求传入。
- 保留已有有效自定义配置，不强制覆盖；交付包不带本机测试密钥。
- 密钥按用户授权仅写入本地服务端配置，不记录在本文或源码中。

## 在网页中更换配置

打开网站右上角“API 设置”。选择预设，或手动设置格式、Base URL/完整端点、模型和 API Key。先点“测试连接”，看到有效 JSON 响应后点“保存并应用”。测试不会更改生效配置，可能消耗少量服务商配额。

密钥输入框不会回显已保存内容。留空会保留当前服务的密钥；换到不同 origin（协议、主机或端口改变）时必须重新提供该服务的密钥。停用 AI 后恢复本地演示。

## 支持的请求格式

当前默认端点为 `https://api.deepseek.com/chat/completions`，使用服务端 Bearer 鉴权。下表保留既有华东师大兼容协议示例。

| 格式 | 华东师大 Base URL | 最终请求路径 | 认证 |
| --- | --- | --- | --- |
| Chat Completions | `https://chat.ecnu.edu.cn/open/api/v1` | `/open/api/v1/chat/completions` | Bearer |
| Responses | `https://chat.ecnu.edu.cn/open/api/v1` | `/open/api/v1/responses` | Bearer |
| Anthropic Messages | `https://chat.ecnu.edu.cn/open/api/anthropic` | `/open/api/anthropic/v1/messages` | Bearer |

普通兼容服务也可填写相应 Base URL。完整端点会去除重复后缀；页面即时显示实际请求地址。Anthropic 支持 Bearer 和 `x-api-key`，并携带 `anthropic-version: 2023-06-01`。当前不提供自定义任意认证 Header；需要工作区 Header 等特殊协议的服务应扩展适配器。

Chat Completions 高级选项支持 `max_tokens` 或 `max_completion_tokens`。Responses 使用 `max_output_tokens`，并设置 `store: false`。这不替代服务商自己的数据保留政策。

JSON 参数不被服务支持时可关闭原生 JSON 模式，改用提示词约束。行程、手记和连接测试结果仍需通过 JSON 与 Zod 校验。道士聊天增量纯文本不要求 JSON。

## 保存与运行

1. 首次运行从 `.env` 读取配置。
2. 网页保存后使用 `.local/ai-config.json`，优先于 `.env`；每次请求读取当前配置，无需重启。
3. 两个位置均在 Git 忽略名单内，且禁止被开发服务器作为文件提供。
4. 密钥保存在本机磁盘明文文件中，不是跨用户密钥管理系统。设置接口只允许回环地址、合法本机 Host、同源 JSON 请求。
5. 密钥不写入前端构建或浏览器 LocalStorage，不回传已保存值；上游错误响应也不原样展示。
6. 同时最多执行一个模型请求；认证、参数、超时、配额等错误有独立提示。已配置 AI 的道士聊天失败显示错误及重试，不以本地答案替代成功。行程和手记可使用标注清楚的本地回退。

公开部署使用服务端环境变量；反向代理禁止 /api/settings，不能让访客更改服务器密钥。SSE 路径不要缓存或整包缓冲；部署包附 Caddy/Docker/Render 模板与详细说明。当前服务器是单份共享 AI 配置，不提供多人独立密钥。

## 验证

2026-10-07：DeepSeek deepseek-flash 真实连接 HTTP 200；页面真实多轮、流式、取消、重试与刷新配置已验证。一次文化问答误把“中路”写成“南路”，保留失败证据；加入逐字事实索引后，同题最后一次实际回复方位正确。401/402/429/超时、未配置演示及自定义配置使用隔离模拟接口测试，不能当作真实上游故障测试。桌面和手机尺寸聊天各 14 项检查通过。完整记录随 CC 交付报告提供。

以下是历史验证记录：

2026-09-29：18 项自动化测试、类型检查和生产构建通过。使用用户授权密钥实际测试华东师大三种格式，均返回 HTTP 200 与有效 JSON；小道士讲解返回 `mode: ai`。其他服务商使用协议测试桩验证，没有使用其他服务商真实密钥验证。

## 官方依据

- [DeepSeek Chat Completions](https://api-docs.deepseek.com/api/create-chat-completion/)
- [DeepSeek Thinking Mode](https://api-docs.deepseek.com/guides/thinking_mode/)
- [DeepSeek Error Codes](https://api-docs.deepseek.com/quick_start/error_codes/)

- [华东师大模型介绍](https://developer.ecnu.edu.cn/vitepress/llm/model.html)
- [华东师大 Chat Completions](https://developer.ecnu.edu.cn/vitepress/llm/api/completions.html)
- [华东师大 Responses 兼容](https://developer.ecnu.edu.cn/vitepress/llm/api/responses.html)
- [华东师大 Anthropic 兼容](https://developer.ecnu.edu.cn/vitepress/llm/api/anthropic.html)
- [华东师大结构化输出](https://developer.ecnu.edu.cn/vitepress/llm/api/structuredoutput.html)
- [OpenAI Chat Completions](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create)
- [Anthropic Messages](https://platform.claude.com/docs/en/api/messages/create)

## 流式交互

POST /api/guide/stream 使用 question、spotId 和 history；服务端发送 meta/delta/done/error 事件。前端仅把完成的对话加入后续上下文，取消或失败的部分回复明确标注；重试保留原问题与上下文，不重复添加用户消息。取消、关闭抽屉或连接中断会中止上游读取。
