# NOTES · 当前工作便签

> 这里只保留短期恢复所需的信息；稳定事实应进入 Contracts / ADR，完成记录进入 logs，正式待办进入 `BACKLOG.md`。

- 当前产品定义与 Memory 术语见 ADR 0037、`contracts/product.md` 和 `contracts/data-model.md`。
- 当前唯一功能 frontier 是 GitHub #37；长期提案不构成实现授权。
- `knowledge/proposals/asterism-transformation-roadmap.md` 保存 Phase 0–9 的完整构想，冲突时以 Contracts 和 Accepted ADR 为准。
- 本机没有可用 Docker；数据库 migration / RLS / pgTAP 通过 GitHub Actions 或真实 Supabase 环境验证。
- 浏览器 embedding 资产仍由 `apps/web/scripts/prepare-embedding-assets.mjs` 管理；构建可使用现有缓存，受限网络下的降级方式见 `apps/web/EMBEDDING_ASSETS.md`。
