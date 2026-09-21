# 2026-09-21 · Ask 改为目录常驻浅层 Agent

## 做了什么

Ask Asterism 从固定 top-K RAG 改成目录常驻浅层 Agent（ADR 0045）。

- 新开 ADR 0045，修订 ADR 0042 第 5 条与 ADR 0044 的推荐锚点。防幻觉结构改为「`repoId` ∈ 本轮已 `expand` 的集合」。
- `@asterism/core` 新增目录分档、`filter` / `search` / `expand`、循环状态机；`search` 取消最低分门槛与 12 条上限。引用解析改为 `repoId` + read gate。SSE 增加 `tool_call` 与 OpenAI 流式 tool_calls 拼装。
- `ask-generate` 放行 `tool` 角色与 `assistant.tool_calls`，消息上限 250_000 / 600_000，透传 `tools` / `tool_choice`，`test` 升级为连通性 + 工具 + 长上下文能力探针。
- 前端循环编排不再依赖 embedding / recalling。软预算耗尽与未找到分轨，提供「继续深入」。不合格模型降级到固定 top-K。
- consent 升到 v3：如实披露全库元数据出网；v1 / v2 不得静默升级。

## 验证

本地四道门禁已通过：`pnpm lint` / `pnpm typecheck` / `pnpm test` / `pnpm build`。

## 未完成

真实账号 smoke 与远端重新部署 `ask-generate` 仍由维护者执行。
