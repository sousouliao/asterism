# 0043 · 还原 Ask 连接管理器：本地连接库、模型检测与连接探针

- Status: Accepted
- Date: 2026-09-20
- Restores (adapted): ADR 0018 的连接配置体验（组件结构、交互与文案），其运行时已被 ADR 0032 退役
- Amends: ADR 0042 的 Settings 形态——单一内联 BYOK 表单升级为连接管理器；key 存储、Provider 白名单、无状态代理与出网同意四条边界不变
- Preserves: ADR 0032 不复活服务端 Provider / 凭据架构、ADR 0042 Provider 白名单与 SSRF 收敛、ADR 0039 consent v2 模式

## Context

维护者要求完整还原当年被删除的「配置这部分」——生成连接的配置体验（具名连接列表、
新建 / 编辑对话框、带模型检测的探活对话框、活跃连接与笔记偏好），并与当前 Ask BYOK
实现（ADR 0042）整合。旧运行时的服务端凭据库（加密、轮换、`manage-ai-connections`）
已被 ADR 0032 退役且明令不得直接复活；ADR 0042 又规定 key 只存浏览器、Provider 固定
四家白名单、传输只经无状态 `ask-generate`。

因此本次还原的是**界面与交互层**（三个组件、hooks 形状、i18n 文案结构均自
`edb5925~1` 迁移），底座按现行架构重建。

## Decision

1. **连接存储为浏览器本地库**：`asterism:ai-connections:v1:{userId}` 与
   `asterism:ai-settings:v1:{userId}`（按用户隔离、版本化），字段名沿用旧安全投影
   （`adapter` / `credentialHint` / `generationCapability`）使界面无需改写。key 明文
   仅存本浏览器，与 ask-byok 同一信任边界；服务端仍零存储、零加密设施。
2. **模型检测与连接探针作为 `ask-generate` 的新动作**，部署面不新增函数行：
   - `action: 'models'`：转发 `GET {base}/models`，解析 `data[].id`，去重排序并封顶
     200 条（OpenRouter 会返回数百条）；失败时界面保留手填模型 ID 路径——即 ADR 0018
     「发现优先、失败手填」策略。
   - `action: 'test'`：发送固定最小生成探针（json mode 按 Provider 能力启用），结论
     `ok / reason` 沿用旧探针词汇（`unauthorized` / `empty_response` / 网络类），由
     客户端写回本地连接记录的状态与能力。
   - 两动作复用同一 Provider 白名单、key 透传规则与超时；不新增表或 secret。
3. **还原三组件**：`AiConnectionFormDialog`（适配器选择改为当前白名单四家；自定义
   base URL 输入随 ADR 0042 的 SSRF 收敛不还原）、`AiConnectionTestDialog`（检测按钮 +
   下拉 + 手填兜底 + 三态提示，逐行还原）、`AiConnectionsManager`（连接列表、启停、
   增删改、探活、活跃连接 / 笔记偏好）。hooks 名称与 mutate 签名沿用旧
   `use-ai-connections`，底座换为本地库。
4. **活跃连接即 Ask 配置**：激活已通过探针的连接时，把 provider / 已验证模型 / key
   写入 ask-byok（问答路径不变）；删除活跃连接则清空 Ask 配置。激活前必须通过
   ADR 0042 出网披露同意，Provider 与已同意不一致时重新披露——单 provider 场景的
   同意语义与原实现一致。
5. **「包含笔记」偏好落地**：`buildAskPrompt` 增加 `includeNotes`（缺省 true，即
   ADR 0042 同意范围），偏好关闭后 prompt 不携带 `whySaved` / `note` 原文，其余元数据
   不变。
6. **能力读取函数回归 core**：`readGenerationCapability` / `readTestedModel` 自旧
   `generation-selection.ts` 迁入 `repos/ask.ts`，纯函数、形状不变。

## Consequences

- Settings 的 Ask 分区恢复为完整的连接管理体验；原有内联 BYOK 表单移除，其同意流程
  与「就绪 / 未配置」徽章保留为分区头部。
- 服务端凭据库、多 key 排序、轮换、自定义端点仍然退役；若未来需要这些，须按
  ADR 0032 / 0042 另立 ADR。
- 自部署实例只需重新部署 `ask-generate`（无新函数、无新 migration、无新 secret）；
  不重新部署时生成照常，模型检测与探针返回不可用并由界面回退手填。
- 模型检测列表按字典序排序并封顶，顺序不承诺与上游一致。
