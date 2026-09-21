# ADR 0044 · Ask 回答改为流式 Markdown（SSE + 隔离的渲染引擎）

- Status: Accepted
- Date: 2026-09-21
- Amends: ADR 0042 第 7 条（「v1 为单次 JSON 请求，不做流式」）
- Preserves: ADR 0042 的 BYOK、Provider 白名单、无状态代理、出网同意、召回为空不调用上游、推荐由客户端校验且证据卡片只渲染本地数据；ADR 0043 的 `models` / `test` 动作保持非流式 JSON
- Implements: Ask 回答流式输出与 Markdown 渲染

## Context

ADR 0042 把 Ask 生成为单次 JSON completion：模型必须一次吐出
`{"summary","recommendations"}`，完整响应才能做引用校验。这在 v1 是正确的
——JSON 字符串里的 Markdown 既被转义，也无法在流中途安全解析。真实使用里，
2–6 句回答仍要等整段返回才出现，进行中反馈只剩 spinner。

维护者要求改为流式输出，并使用 `@lobehub/streamdown` 渲染 Markdown。这与
0042 §7 直接冲突，必须新开 ADR，不得在实现里悄悄扩张。

约束不变：推荐列表与证据链在结构上不得引用库外仓库；Edge Function 仍是
无状态 BYOK 代理；不引入 Provider SDK。supabase-js 在响应
`Content-Type: text/event-stream` 时把原始 `Response` 交给调用方，流式可以
继续走 `packages/db`，不必绕开数据访问边界。

## Decision

1. **输出契约改为「Markdown 正文 + 末尾推荐哨兵块」**。模型先写回答正文，最后
   给出唯一的围栏：

   ````
   ```asterism-recommendations
   [0, 2]
   ```
   ````

   语言标签固定为 `asterism-recommendations`。围栏体是候选索引的 JSON 数组
   （至多 5 个，可为空）。正文允许段落、列表、加粗 / 斜体、行内与围栏代码；
   **禁止图片、原始 HTML、表格**（不引入 `remark-gfm`，插件面保持为零）。

2. **引用校验仍在流末、仍由客户端执行**。`splitAskStream` 是同一纯函数：流中
   用来裁掉尚未闭合的尾部围栏（用户看不到裸索引闪现），流末用来切开正文与
   推荐。索引校验、去重、越界丢弃、映射 `repoId` 的规则与 ADR 0042 相同。
   缺围栏不视为解析失败——正文照常呈现，推荐为空。防幻觉结构不因流式而
   放松：证据卡片依然只渲染本地召回数据。

3. **`ask-generate` 生成动作改为 SSE 转换，不是上游透传**。上游请求带
   `stream: true`。函数把 OpenAI 兼容 SSE 解码为 Asterism 协议后下发：

   - `event: delta` → `{"text": "..."}`
   - `event: error` → `{"status": "timeout" | "retryable_error" | ...}`
   - `event: done` → `{}`

   客户端不接触 Provider 差异。401 / 403 / 非 2xx 仍在流开始前以 JSON 返回。
   `models` / `test` 动作不变。生成路径删除 `response_format: json_object`
   （探针仍按 Provider 能力启用 json mode）。

4. **超时拆成响应头超时与空闲超时**。整体 60 秒 `AbortSignal.timeout` 会把
   正常的长流掐断。改为：拿到上游响应头限 60 秒；流转换期间连续无 delta
   限 30 秒。二者都在函数内实现。

5. **前端只保留一条路径**。`streamAskGenerate` 消费 SSE；若网关把响应退化成
   JSON `{status:"success",content}`，按单块 delta 降级。不维护并行的非流式
   代码路径。

6. **Markdown 渲染隔离在 `@asterism/ui` 的 `StreamingMarkdown`**。这是仓库里
   唯一接触 `@lobehub/streamdown` 的文件：headless、零外部样式，组件映射到
   既有 token；`prefers-reduced-motion` 关闭逐字淡入；`a` 只放行 http/https
   且强制 `rel="noopener noreferrer" target="_blank"`；`img` 与表格丢弃。
   库本身较新，隔离后替换成本恒为一个文件。

## Consequences

- Ask 回答从纯文本变为受约束的 Markdown；ui-ux 契约同步修订排版与 a11y
  （流式期间 `aria-busy`，避免 role=log 逐 token 播报）。
- 输出不再受 Provider json_object 强约束。容错（缺围栏即空推荐）保证这不会
  退化成整轮失败，幻觉面仍收敛在正文，不进入证据卡片。
- 部署面仍是同一个 `ask-generate` 函数，但生成动作的契约从 JSON 变为 SSE，
  远端必须重新部署后前端流式才会生效。
- 若未来更换渲染引擎、恢复 json_object，或把推荐改回模型内联 citation
  对象，必须新开 ADR。
