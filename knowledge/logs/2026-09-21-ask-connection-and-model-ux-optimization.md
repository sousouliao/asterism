# 2026-09-21 · Ask AI 连接与模型选择体验深度优化

## 背景与诉求

在 Ask Asterism 私有问答的连接配置与使用链路中，存在若干操作阻滞与交互不顺畅的问题：
1. **Provider 列表冗余**：现有选项包含 Groq 与 OpenRouter，用户仅需要精简可靠的 OpenAI 与 DeepSeek 两大核心 Provider。
2. **自定义名称多余**：单用户/自部署场景下连接即 Provider，强行要求输入「连接名称」产生不必要的认知负荷与重复展示。
3. **添加流程未形成测试闭环**：原流程先保存、再单独唤起测试弹窗，容易保存无效 key；测试应前置于弹窗内，通过后才允许保存。
4. **列表卡片缺少快捷测试入口**：已保存连接在卡片上无法一键重新测试，需要点更多操作打开弹窗。
5. **模型发现未联动**：连接测试时应当直接探活并拉取该 Provider 可用模型列表，随连接一同持久化。
6. **Ask 输入框缺少模型切换能力**：底部胶囊输入框需要支持实时切换已配置且可用的模型，无需每次前往设置页切换。

## 方案与实现

### 1. Provider 精简为 OpenAI 与 DeepSeek
- 修订 `packages/core/src/repos/ask-providers.ts`：`AskProviderId` 收窄为 `'openai' | 'deepseek'`。
- 更新相关核心测试单测。

### 2. 精简添加表单与内联测试门禁
- `apps/web/src/components/ai-connection-form-dialog.tsx`：
  - 移除「连接名称」输入项，保存时自动使用 Provider 名称作为默认标识。
  - 集成 `useTestAndDiscoverProbe`：在弹窗内提供「测试连接」按钮；未测试或测试失败时禁用保存按钮，测试通过后展示成功徽标与发现的模型数量，并解锁「保存」按钮。
  - 编辑现有连接时，若未改动 API Key，则允许直接保存；若改动了 Key，则重置测试状态并强制重新测试通过。

### 3. 连接卡片直达测试与模型展示
- `apps/web/src/components/ai-connections-manager.tsx`：
  - 卡片主操作区增加常驻「测试连接」按钮，支持行内 pending 状态、完成时 Toast 提示已发现模型数。
  - 修复 `PendingActionContent` 图标层级：将 `PlugZapIcon` 改为传给 `idleIcon`，彻底解决内层 grid 居中带来的文字左留白与图标间距不一致问题。
  - 卡片副文本清晰展示已发现模型数（例如：「已通过测试 · 已发现 2 个可用模型」）。
  - 设置面板中保留模型选择下拉框，可为当前连接指定默认模型。

### 4. 服务端 Chat 模型智能过滤与模型持久化
- `supabase/functions/ask-generate/handler.ts`：
  - 对 OpenAI `/models` 接口返回的大量非对话模型（如 embeddings, tts, whisper, dall-e, moderation 等）进行智能过滤，仅保留对话/推理类模型。
  - 连接测试通过后，一并将发现的可用模型列表 `models` 持久化到 `AiConnection` 本地存储中。

### 5. 底部 Ask 胶囊输入框模型切换器
- `apps/web/src/lib/ai-connections.ts` 与 `ask-byok.ts`：
  - 提供 `getAvailableAiModels(connections)` 工具函数，合并所有状态为 `valid` 的连接所发现的模型列表。
  - 在 `AiSettings` 中增加 `selectedModel` 字段，并在 BYOK 解析时生效。
- `apps/web/src/components/ask/ask-panel.tsx`：
  - 在底部常驻 pill composer 输入框内集成模型切换芯片（Chip / DropdownMenu）。
  - 下拉菜单按 Provider（DeepSeek / OpenAI）分组列出所有已验证模型，当前模型显示对勾标记，并提供快捷跳转「管理连接…」。
  - 在输入框内选择模型即时生效，无缝应用于下一次问答。

### 6. 国际化与文案对齐
- 同步补齐 `apps/web/src/i18n/locales/zh-CN.json` 和 `en.json` 相关键值（包括模型切换、添加前测试、发现模型数量等）。

## 验证结论

1. **自动化测试**：
   - `@asterism/core`：17/17 测试套件，141/141 测试全部通过。
   - `@asterism/web`：51/51 测试套件，270/270 测试全部通过。
2. **静态检查与代码风格**：
   - `pnpm typecheck`：8 个 package 全绿，无类型报错。
   - `pnpm lint` & `pnpm format`：Biome 检查通过，0 错误 0 警告。
3. **打包构建**：
   - `pnpm build`：全部包构建成功。
