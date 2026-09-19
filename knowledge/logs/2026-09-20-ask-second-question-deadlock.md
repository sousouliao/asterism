# 2026-09-20 · Ask 第二问死锁与语义通道绕过修复

## 背景

维护者执行 #41 真实账号 smoke 时发现：Ask 面板提问后一直停在「正在检索你的收藏…」，
DevTools 显示 `search_user_repo_embeddings` RPC 已返回 200，但 `ask-generate` 永远
不会发出。复现条件为同一面板会话内的**第二次提交**（追问，或出错后的「重试」）。

## 根因（两个独立缺陷）

1. **提交 id 不自增（死锁直接原因）**：`useAskQuestion` 的 `nextId` ref 在提交时从未
   自增，每次提交的 `submission.id` 恒为 1；编排 effect 以 `settledId` 防重入，第一问
   消费掉 `settledId = 1` 后，任何后续提交都满足 `settledId === submission.id` 而
   直接 return——phase 永远停在 `recalling`。语义检索 hook 只受 phase 驱动、与编排
   effect 无关，因此 RPC 照常发出并成功，造成「网络成功但界面转圈」的表象。
2. **`isSearching` 在防抖窗口内失真（语义通道被静默绕过）**：`useSemanticNeighbors`
   的 `isSearching = enabled && isFetching`，而 `enabled` 以防抖后的查询为准——
   提交后的 180ms 防抖窗口内 `enabled` 为 false、`isSearching` 为 false。Ask 编排
   在仓库列表暖缓存（生产常态）时会在窗口内直接通过守卫，以**空语义距离表**发起
   词法-only 召回与生成；语义通道只在冷缓存时偶然生效。

面板测试完全 mock 了 `useAskQuestion`，编排层此前无任何测试覆盖，故两缺陷均漏网。

## 修复

- `apps/web/src/data/use-ask-question.ts`：提交时 `nextId.current += 1`，追问 / 重试
  获得新 id，防重入守卫不再吞掉后续提交。
- `apps/web/src/data/use-semantic-search.ts`：`isSearching` 改为「fetch 进行中 **或**
  查询变化仍处于防抖窗口」，等待方在窗口内同样看到「还在检索」；导出
  `QUERY_DEBOUNCE_MS` 供测试跨过防抖。

## 测试

- 新增 `apps/web/src/data/use-ask-question.test.tsx`（3 例）：追问在同年会话内可完成
  第二轮回答；`provider_rejected` 后重试可完成；语义通道在途时不得进入 generating
  （含无词法命中仓库经语义补充成为候选的断言）。已验证：还原 id 修复后前两例按预期
  失败，修复后通过。
- `use-semantic-search.test.tsx` 补防抖窗口断言（变更后未跨过防抖时 `isSearching`
  必须为 true），`flush` 相应跨过防抖窗口。

## 门禁

`pnpm lint` / `pnpm typecheck` / `pnpm test`（web 252 例，含新增 7 例）/ `pnpm build`
全部通过。纯客户端变更，不涉及 migration / Edge Function，远端无需按 runbook 部署；
Web 端随下一次 git 集成部署生效，此后可继续 #41 的真实账号 smoke。
