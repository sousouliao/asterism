# 2026-09-20 · #36 以来的代码复核与整改

对「产品转向」起点 GitHub #36 至今的全部改动做了一次系统复核（安全、数据正确性、前端正确性、性能、整洁度），并按
安全 → 数据正确性 → 前端正确性 → 性能 → 整洁度 → 门禁的顺序逐项整改。四道门禁（lint / typecheck / test / build）全绿，
web 263 单测通过。

## 复核结论：一条贯穿性缺陷

多处出现同一种「双份存储」反模式——同一事实被存两次，然后靠写入路径手工保持同步。它在本轮暴露为三个独立缺陷：
BYOK 密钥快照、note repo id 冗余查询、Memory 的 `source_created_at` 回填。整改方向统一为「单一真相源 + 派生读取」。

## 安全

- **BYOK 单一真相源**：`ask-byok` 原先把 API key 快照进 localStorage，轮换或停用连接后 Ask 仍在用旧 key。改为只存同意
  （`connectionId` / `consentedProvider` / `consentedAt`），key、model、provider 全部在运行时从连接库解析；legacy v1 快照
  在读取时清除。`useAskByok` 经 `useSyncExternalStore` 订阅连接变化，撤销同意会在飞行中把 `run()` 重置回 idle。
- **`ask-generate` 加固**：补 `max_tokens` 上限（2048）防配额被刷；`redirect: 'manual'` 防重定向泄露凭据；provider 白名单
  查表改用 `Object.hasOwn`（原 `in` 可被 `constructor` 等原型键穿透）；CORS 由 `ASK_ALLOWED_ORIGINS` 配置，自部署缺省仍为 `*`。
- **Provider 白名单单源化**：抽出无依赖的叶子模块 `packages/core/src/repos/ask-providers.ts`，同时服务 `@asterism/core` 与
  Deno Edge Function，消除两份会漂移的定义。

## 数据正确性

- `saveMemory` 由「读后写」改为带 `onConflict: 'user_id,repo_id'` 的单次 upsert，消除 TOCTOU。
- 新增 migration `20260920120000_memory_repair_backfills_source_created_at.sql`：`public.ensure_user_memories` 以条件 upsert
  （仅当 `source_created_at is null` 时回填）原子完成补齐，取代 `sync-stars` 里 `ignoreDuplicates: true` 会静默跳过回填的写法；
  pgTAP `supabase/tests/memory_repair.test.sql` 锁住语义。
- 删除 `useMemoryNoteRepoIds` 冗余查询，note repo id 直接从 `useMemoriesList` 派生，消除 Browse 的加载竞态。

## 前端正确性

- 无 `userId` 时不再渲染点了也不落盘的反馈按钮；Insights 的 memories 加载失败改为可重试错误态而非静默吞掉。
- Resurface 压制缓存引入 `validUntil` 过期判定，并监听 `storage` 事件做跨标签页失效。
- `Date.now()` 以 `useState` 初始化固定时间基准，避免同会话内新近度打分不可复现。
- `useContext` → `use()`（React 19 约定）；修掉 match-explanation 的 key 碰撞。

## 性能

`findMutualSemanticNeighbors` 原本每个锚点要做 13 次全量扫描，且每次切换 Quick Look 都重算归一化。抽出
`buildSemanticNeighborhoodIndex`：一次性 L2 归一化为 `Float64Array`（余弦退化为点积），Top-K 池用有界插入替代全量排序并按
repo 记忆化。Web 侧索引只依赖数据集本身，切换锚点不再重建。旧签名保留，传数组即按单次查询处理。

## 整洁度

- `repo-inspector.tsx` 1265 → 754 行，拆出 `repo-inspector/{floating-frame,section-label,related-stars-section,collections-section,memory-section,unsaved-memory-dialog}`。
- `repos/ask.ts` 571 → 72 行，拆为 `ask-candidates` / `ask-prompt` / `ask-parse`，原文件退化为能力读取 + 汇总导出。
- dev 预览页共用 `fixtures/preview-repo.ts`；Resurface 预览的「Reset feedback」不再 `localStorage.clear()`（会顺手登出真实会话），
  只删自己的反馈键；预览页 `text-[13px]/[12px]` 换成等值的 `text-body` / `text-caption`。

## 已知遗留

`text-[13px]` 在 20 余个未被本轮触及的文件中仍是既有写法（与 `text-body` 等值），属存量债，未在本轮批量替换以免扩大 diff。
