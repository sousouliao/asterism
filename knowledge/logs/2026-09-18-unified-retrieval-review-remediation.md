# Unified Retrieval · 代码复核与收口

Date: 2026-09-18
GitHub: #39
Status: Review remediation complete
Decision: ADR 0039

## Outcome

- 修正词法检索排序：先按 `why_saved` → `note` → `name` → `description` → `topic` 的结果级个人意图优先级分组，再在同组内应用用户选择的排序。
- 语义扩展不再把合并向量猜测为 Memory 命中；只输出中性、可验证的语义理由。
- Related Stars 删除“双方都有 Memory”固定加成；Memory 只通过实际向量内容参与相似度。
- 修正 `unsupported` 死分支：运行时进入 `degraded` 或 embedding 查询失败时启用关键词降级；Topic / Memory 词交集负责建立候选，同语言只作排序加分。
- embedding consent 升级为 v2，重新取得包含私有 Memory 本地处理的明确授权；界面说明原文留在浏览器、只保存 RLS 隔离的派生向量。
- Match Explanation 使用现有设计 token，Tooltip 触发器可键盘聚焦，并在批量选择模式隐藏；中英文文案同步更新。
- 补充 Memory 变化触发增量重嵌、降级分支、跨结果排序和批量选择等回归测试。

## Verification

- `pnpm typecheck`：全工作区 9 / 9 tasks 通过。
- `pnpm lint`：Biome 检查 285 个文件，无错误。
- `pnpm test`：全工作区 7 / 7 tasks 通过；Core 81、DB 41、Web 192、Supabase Functions 31 个测试全部通过。
- `pnpm build`：全工作区 6 / 6 tasks 通过；保留既有 Web 主 chunk 超过 500 kB 的观察项，不在无指标证据时扩展本 issue。
- `git diff --check`：通过。
- Ego Browser 桌面（2304 × 1315）与移动端（390 × 844）视觉 QA：解释徽章、Tooltip、键盘焦点与响应式布局正常，无横向溢出；批量选择模式下徽章从 9 个降为 0，整卡选择语义正确。
