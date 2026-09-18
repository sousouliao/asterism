# NOTES · 当前工作便签

> 这里只保留短期恢复所需的信息；稳定事实应进入 Contracts / ADR，完成记录进入 logs，正式待办进入 `BACKLOG.md`。

- 当前产品定义与 Memory 术语见 ADR 0037、`contracts/product.md` 和 `contracts/data-model.md`。
- GitHub #40 Resurface 本地实现已完成（ADR 0041）；真实账号验收与 issue 关闭待部署 preview 后进行。`pnpm dev` 后访问 `/dev/resurface-preview` 可在无后端数据下查看唤醒卡片全部分支。
- ADR 0038 确认干净切换：没有旧 Note 用户数据，不做 Note 迁移，也不兼容 v1/v2 JSON。
- `knowledge/proposals/asterism-transformation-roadmap.md` 保存 Phase 0–9 的完整构想，冲突时以 Contracts 和 Accepted ADR 为准。
- 本机没有可用 Docker；数据库 migration / RLS / pgTAP 通过 GitHub Actions 或真实 Supabase 环境验证。
- 浏览器 embedding 资产仍由 `apps/web/scripts/prepare-embedding-assets.mjs` 管理；构建可使用现有缓存，受限网络下的降级方式见 `apps/web/EMBEDDING_ASSETS.md`。
