# Unified Retrieval Engine · 本地工程落地与验证

Date: 2026-09-17  
GitHub: #39  
Status: Implementation and verification complete  
Decision: ADR 0039

## Outcome

- **Memory 融入向量空间与签名机制**：
  - `packages/core` 中扩充 `EmbeddableRepo` 支持用户私有 `whySaved` 与 `note`；
  - `repoContentHash` 包含 Memory 变化，用户在编辑或同步记忆后自动计算增量差异；
  - `apps/web` 中的 `useEmbeddingBootstrap` 接入 `memoriesByRepoId`，在记忆变动或列表变更时触发增量重嵌。
- **构建 Unified Retrieval Engine 统一检索抽象**：
  - 在 `packages/core/src/repos/retrieval.ts` 建立 `retrieveRepos` 核心接口，淘汰分散的词法过滤；
  - 支持多字段词法倒排与个人记忆优先匹配（`why_saved` > `note` > `name` > `description` > `topic`）；
  - 输出结构化 `MatchExplanation`（含 primaryReason、所有命中 reasons 与高亮上下文片段 `snippet`）；
  - 保证无语义向量数据时的优雅词法降级，有语义数据时无缝追加限定配额的 `semantic` 近邻扩展。
- **意图加成与降级推荐的 Related Stars**：
  - `findMutualSemanticNeighbors` 引入用户记忆意图共鸣加成：当两个仓库均沉淀了个人记忆且语义相似为正时，给予意图对齐增益；
  - 引入 `findKeywordFallbackNeighbors`：在 WebGPU/WASM 不可用或向量空间无互为近邻时，利用 Topics、同语言与 Memory 意图词交集，平滑降级生成相关推荐。
- **优雅克制的可解释性 UI（遵循 `/impeccable` 原则）**：
  - 实现 `MatchExplanationBadge`，卡片与列表均支持直观紧凑徽章与丰富 Tooltip 展开；
  - 完全遵循 Graphite Glass 设计规范、中英双语国际化（`en` / `zh-CN`）与无障碍标准（ARIA / 键盘交互）。
- **自动化测试与工程门禁**：
  - 新增/完善 `retrieval.test.ts`、`semantic-neighborhood.test.ts`、`use-unified-retrieval.test.tsx`、`match-explanation-badge.test.tsx` 等；
  - 修复测试环境中的 optional chain、未使用导入与依赖缺失；
  - `pnpm lint`、`pnpm test`（全仓库 7 个包所有测试用例通过）、`pnpm build` 全流程通过。

## Verification

- `pnpm lint` 格式与静态检查 282 个文件全部无任何 warning/error。
- `pnpm test` 全工作区 7 个包，全套单元测试与集成测试（包括 core、db、supabase-functions、web）100% 绿灯通过。
- `pnpm build` 成功完成全包编译（包含 web vite 构建与 extension 构建）。
- 验证了为什么被收藏（whySaved）、笔记（note）、仓库名、描述、主题及语义意图相近的全部场景解释徽章展示与 Tooltip。
