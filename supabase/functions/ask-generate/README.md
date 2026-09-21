# ask-generate

Ask Asterism 的无状态 BYOK 代理（ADR 0042 / 0043 / 0044 / 0045，GitHub #41）：校验 Supabase 会话后，按请求动作把客户端组装的载荷转发到用户 BYOK 的 OpenAI 兼容上游。Provider 白名单（DeepSeek / OpenAI / Groq / OpenRouter）映射固定 base URL，不接受白名单之外的自定义端点。用户的 Provider key 仅随本次上游请求透传，不写入日志、Postgres 或任何存储；函数不保存会话状态。

动作：

- **默认（生成，ADR 0044 / 0045）**：把客户端组装的 prompt（含目录前缀、历史与 `tool` 消息）以 `stream: true` 转发到 `{base}/chat/completions`，透传 `tools` / `tool_choice`，把上游 OpenAI 兼容 SSE 转换为 Asterism 协议（`event: delta | tool_call | error | done`）。响应头超时 60 秒，流空闲超时 30 秒。单条消息上限 250_000 字符、合计 600_000。上游 401 映射为 `invalid_provider_key`，4xx/429 映射为 `provider_rejected`（均在流开始前以 JSON 返回）。
- **`action: 'models'`**：转发 `GET {base}/models` 并解析 `data[].id`（去重、字典序、封顶 200 条），供 Settings 的模型检测下拉使用；失败由客户端回退手填模型 ID。
- **`action: 'test'`**：先做连通性探针，再检测工具调用规范性与长上下文定位；结论含 `ok` / `reason` / `tools` / `longContext` / `mode`（`agent` | `fixed`），由客户端写回本地连接记录。

部署：

```sh
supabase functions deploy ask-generate
```
