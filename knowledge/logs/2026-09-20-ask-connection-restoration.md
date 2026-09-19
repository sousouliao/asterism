# 2026-09-20 · Ask 连接管理器还原（ADR 0043）

## 背景

维护者指出此前的模型检测整合「UI 与当时完全不一样」，要求**完整还原**当年的配置
体验再接上当前实现。旧运行时（ADR 0018 的 Generation Provider Registry）已在
`edb5925`（ADR 0032）删除；本次自其父提交 `edb5925~1` 逐文件导出并迁移。

## 自历史迁出的内容

| 旧文件（`edb5925~1`） | 去向 |
| --- | --- |
| `apps/web/src/components/ai-connections-manager.tsx`（463 行） | 同名还原；数据层换本地库 hooks，激活接同意门 |
| `apps/web/src/components/ai-connection-form-dialog.tsx`（202 行） | 同名还原；适配器枚举换 `ASK_PROVIDERS` 四家 |
| `apps/web/src/components/ai-connection-test-dialog.tsx`（177 行） | 逐行还原（检测按钮 + 下拉 + 手填 + 三态提示） |
| `apps/web/src/data/use-ai-connections.ts`（146 行） | hook 名称与 mutate 签名还原，底座为 localStorage |
| `packages/db/src/ai-connections.ts` 的类型与安全投影 | 迁为 `apps/web/src/lib/ai-connections.ts` 本地库 |
| `packages/core/src/ai/generation-selection.ts` 的能力读取 | `readGenerationCapability` / `readTestedModel` 迁入 core `repos/ask.ts` |
| `generation-registry.ts` 的 `buildModels` / `parseModels` | 语义迁入 `ask-generate` 的 `models` 动作（函数自包含约定） |
| `settings.ai.*` 双语文案（77 行/语言） | 结构与交互文案还原；描述类文案适配 Ask 语境，adapters 换当前四家 |

## 明确不复原的部分（边界）

- 服务端凭据库（加密、轮换、`manage-ai-connections` / `rotate-ai-connections`）与
  Postgres 表——ADR 0032 禁止复活，连接改存浏览器本地库。
- 自定义 OpenAI-compatible base URL 输入与 SSRF 逐跳校验——ADR 0042 白名单已从根上
  消除该面。
- Google Gemini / Anthropic 原生 adapter——当前代理只讲 OpenAI 兼容协议。
- 旧「整理建议 schema」探针校验——探针改为「非空可解析」并沿用 reason 词汇。

## 新增 / 修改的当前实现

- `supabase/functions/ask-generate/handler.ts`：`action: 'models'`（GET /models 解析、
  去重、字典序、封顶 200）与 `action: 'test'`（最小生成探针，reason 词汇对齐旧版）。
- `packages/db/src/ask.ts`：`invokeAskModels` / `invokeAskTest` 封装与结果折叠。
- `packages/core/src/repos/ask.ts`：能力读取函数回归；`buildAskPrompt` 增加
  `includeNotes`（缺省 true）。
- `apps/web`：本地连接库 + hooks + 三组件 + `SettingsAskSection` 宿主化 +
  `useAskQuestion` 接 `includeNotes`；移除内联 BYOK 表单与其 i18n key。
- 测试：edge 19 / db 13 / core 24 / web 248（新增 manager 7、hooks 7、本地库 2、
  section 2 重写，settings 页测试补 QueryClientProvider）。

## 验证与后续

- 四道门禁全绿：`pnpm lint` / `typecheck` / `test` / `build`。
- 过程中发现并修复一个真实缺陷：激活分支的 `{ generationConnectionId }` 属性简写在
  运行时抛 ReferenceError（vitest 不做类型检查，typecheck 抓住后修正）。
- 远端：`supabase functions deploy ask-generate --project-ref hqtrmulypxwdqvzlkhke`
  已于 2026-09-20 执行（CLI 2.109.1，index.ts / handler.ts 资产均已上传）；传输层
  smoke 通过——OPTIONS 预检 200，`models` 动作无 JWT / 伪造 JWT 均 401，生成路径
  回归正常。剩余：维护者真实账号 smoke（建连接 → 检测模型 → 激活 → 提问 → 引用）
  后关闭 #41。
