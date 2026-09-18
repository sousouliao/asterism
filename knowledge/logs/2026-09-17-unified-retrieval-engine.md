# Unified Retrieval Engine · 本地工程落地与验证

Date: 2026-09-17  
GitHub: #39  
Status: Implementation and verification complete  
Decision: ADR 0039

> 2026-09-18 correction: 后续代码复核发现原记录中的 Memory 存在加成、同语言独立降级候选与语义字段归因并不可靠，且降级分支存在类型错误。最终行为与门禁结果以 `2026-09-18-unified-retrieval-review-remediation.md` 为准。

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
- **Memory-aware 与降级推荐的 Related Stars**：
  - Memory 通过每个仓库的合并本地向量自然参与语义近邻，不再根据“双方都有 Memory”给予无法证明内容相关的固定加成；
  - `findKeywordFallbackNeighbors` 在运行时降级或向量空间无互为近邻时，仅以 Topic / Memory 关键词交集建立候选；同语言只作为同级排序信号。
- **优雅克制的可解释性 UI（遵循 `/impeccable` 原则）**：
  - 实现 `MatchExplanationBadge`，卡片与列表均支持直观紧凑徽章与丰富 Tooltip 展开；
  - 完全遵循 Graphite Glass 设计规范、中英双语国际化（`en` / `zh-CN`）与无障碍标准（ARIA / 键盘交互）。
- **自动化测试与工程门禁**：
  - 新增/完善 `retrieval.test.ts`、`semantic-neighborhood.test.ts`、`use-unified-retrieval.test.tsx`、`match-explanation-badge.test.tsx` 等；
  - 修复测试环境中的 optional chain、未使用导入与依赖缺失；
  - `pnpm lint`、`pnpm test`（全仓库 7 个包所有测试用例通过）、`pnpm build` 全流程通过。

## Verification

- 本记录所述门禁结果在后续复核中被不可达分支的 `TS2367` 推翻；修正后的全量验证见 2026-09-18 follow-up log。
