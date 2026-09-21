# 2026-09-21 · 撤销 Ask 的能力分级与同意重签（ADR 0046）

## 触发

ADR 0045 上线后，维护者（也是唯一用户）问「你好」得到「收藏库中未找到匹配项目」。
根因是能力分级：既有连接记录里没有 `mode` 字段，`readAskGenerationMode` 默认判为 `fixed`，
于是所有既有连接在部署瞬间静默退回 ADR 0042 的固定 top-K 召回——而该路径在
`tokenizeQuestion` 抽不出实义词时直接返回 `not_found`。同时 consent v3 作废了 v2 同意，
要求重新确认。两道门叠加，表现为「改完之后问都不能问了」。

## 判定

两道门都撤销，理由见 ADR 0046：

- 分级保护的失败模式不存在。不调工具的模型在 Agent 路径上是**降级但可读**
  （拿到完整目录、正文正常、read gate 让推荐为空），比被降级到的固定路径更好。
  用更差的路径保护更好的路径是设计错误，而且降级不可见。
- 同意重签在单用户自部署下不产生新的知情，只产生一次无法解释的功能中断。
  披露文案本身已写明「整份收藏库目录」。

## 改动

- `packages/core`：删除 `selectAskCandidates`、`buildAskFixedPrompt`、`parseAskFixedResponse`、
  `readAskGenerationMode`、`AskGenerationMode`；`GenerationCapabilityView` 收回到
  `{ ok, model, testedAt, reason }`；`AskRecommendation` 去掉只服务固定路径的 `index`。
  `ask-candidates.ts` 只保留 `tokenizeQuestion` 与 `AskCandidate`（前者仍被 `search` 工具使用）。
- `supabase/functions/ask-generate`：`test` 回到单次连通性检测，删除 ping / needle 两次探测请求。
- `packages/db`：`AskTestOutcome` 的 `passed` 不再携带能力字段。
- `apps/web`：`useAskQuestion` 只剩 `runAgent`；`AskByokConfig` 去掉 `mode`；
  `readAskConsent` 发现 v2 同意时迁移到当前键而非作废（v1 明文 key 快照仍读取即删）。

## 门禁

`pnpm lint` / `typecheck` / `test` / `build` 全绿；core 141、db 58、web 270、
supabase-functions 60 项测试通过。

## 遗留

面向多用户托管部署时，出网范围变更的再确认与模型准入需要重新立 ADR——
ADR 0046 的前提是单用户自部署。
