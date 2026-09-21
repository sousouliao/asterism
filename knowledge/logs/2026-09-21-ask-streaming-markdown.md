# 2026-09-21 · Ask 回答流式化（SSE + streamdown）

## 做了什么

Ask Asterism 的回答从「等完整 JSON 再渲染纯文本」改为边生成边渲染 Markdown。

- 新开 ADR 0044，修订 ADR 0042 第 7 条。防幻觉结构不变：推荐索引仍在流末由客户端校验，证据卡片只渲染本地召回数据。
- 输出契约改为 Markdown 正文 + 末尾 `` ```asterism-recommendations `` 哨兵块。`splitAskStream` 在流中与流末共用，未闭合的哨兵不会闪进正文；缺围栏不当作解析失败。
- `ask-generate` 生成动作带 `stream: true`，把上游 OpenAI 兼容 SSE 转成 Asterism 协议（`delta` / `error` / `done`）。响应头超时 60 秒，流空闲超时 30 秒。`models` / `test` 仍为 JSON。
- `@asterism/db` 的 `streamAskGenerate` 消费 SSE；网关退化成 JSON 时按单块 delta 降级。
- `@asterism/ui` 的 `StreamingMarkdown` 是唯一接触 `@lobehub/streamdown` 的文件：token 映射、reduced-motion 关闭逐字淡入、链接只放行 http/https，丢弃图片与表格。

## 界面

生成中正文逐段出现；composer 以「停止生成」取代 spinner。消息区流式期间 `aria-busy`，避免 `role="log"` 逐 token 播报。用户上滚后停止自动贴底。

## 验证

`pnpm lint` / `pnpm typecheck` / `pnpm test` 全绿。

## 未做

远端尚未重新部署 `ask-generate`。未部署前，生产仍走旧的 JSON 生成路径；新前端会把 JSON `{status,content}` 当作单块流降级，但模型若仍被旧函数要求 json_object，正文会是 JSON 字符串。部署是本切片生效的前提。
