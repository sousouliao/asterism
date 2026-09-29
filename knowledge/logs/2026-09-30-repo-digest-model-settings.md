# 2026-09-30 · 设置页速读模型配置与速读凭据解耦

## 背景与问题

此前实现单仓库核心速读时，速读模块直接借用了 Ask Asterism 的全局提问凭据（`useAskByok`），并在未经确认的情况下在设置页为连接卡片添加了“启用连接”与“当前活跃”的单选机制。用户指出：“设置页里只是配置 provider，不需要指定哪个是活跃连接”，并要求在设置页偏好区域新增针对单仓库速读（Repo Digest）使用模型的独立配置，其候选模型列表与全局 Ask 对话框底部的模型切换器完全对齐。此外，设置页顶栏徽章判定需要优化：只要用户配置了测试通过的有效 Provider 连接，即显示「已就绪」。

## 方案与实现

1. **设置页职责归位与冗余逻辑清理**：
   - 撤销此前未经确认的单选连接机制与“启用”/“当前活跃”徽章。设置页列表纯粹负责 Provider 连接与 Key 的增删改及连通性测试。
   - 彻底移除设置页内多余的活跃连接自动激活和出网披露弹窗残留代码，使 `ai-connections-manager.tsx` 更加干净整洁。
2. **速读模型配置与偏好区域升级**：
   - 在 `AiSettings` 接口中扩充 `digestModel?: string | null` 属性，并在 `ai-connections` 本地存储中持久化读写。
   - `writeAiSettings` 升级支持 `Partial<AiSettings>` 参数并自动与当前设置进行安全合并。
   - 在设置页的连接偏好卡片（`connections.length > 0`）中，新增「速读使用模型」下拉选择控件（`Select`），通过 `getAvailableAiModels(connections)` 聚合所有已通过测试的有效模型，按 Provider（DeepSeek / OpenAI）分组展示。
   - 移动端与桌面端自适应排版（`w-full sm:w-56`），无可用模型时友好提示“暂无可用模型，请先添加并测试通过 AI 连接”。
   - 优化笔记偏好 Switch 的禁用条件为 `!hasValidConnection`，有任何有效连接即可自由切换。
3. **速读凭据解析器构建与调用层解耦**：
   - 在 `apps/web/src/lib/ai-connections.ts` 中实现 `resolveDigestByok(userId)` 与响应式 Hook `useDigestByok(userId)`。
   - 解析规则：优先匹配用户在设置页选定的 `digestModel`；未指定时自动选用首个可用模型（DeepSeek 优先），实现用户添加连接后零额外操作开箱即用。
   - 将 `useRepoDigest` 彻底解绑 `useAskByok`，改用 `useDigestByok`。
4. **设置页顶栏徽章判定修正**：
   - `SettingsAskSection` 顶栏徽章判断逻辑修正为 `isConfigured = Boolean(saved || hasValidConnection)`。用户只要添加并测试通过了任意 AI 连接，顶部即清晰显示「已就绪」徽章。

## 验证与门禁

- **单元测试**：
  - 更新 `src/lib/ai-connections.test.tsx`：覆盖 `digestModel` 存取、默认首个模型回退与指定模型精确匹配；
  - 更新 `src/components/settings-ask-section.test.tsx`：验证有效连接时顶部徽章正确呈现「Ready」；
  - 更新 `src/components/ai-connections-manager.test.tsx`：验证无激活副作用的连接创建、速读模型下拉渲染及无有效连接时的禁用提示；
  - 更新 `src/data/use-repo-digest.test.tsx`：验证使用 `useDigestByok` 解耦后的各种状态流转。
  - **全库 59 个测试套件（316 项单测）全部绿灯通过**。
- **静态检查与构建**：
  - `pnpm lint`（Biome）零报错零警告；
  - `pnpm typecheck`（TypeScript 严格模式）9/9 包全部通过；
  - `pnpm build`（生产构建）全部通过。
