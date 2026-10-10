# NOTES · 当前工作便签

> 这里只保留短期恢复所需的信息；稳定事实应进入 Contracts / ADR，完成记录进入 logs，正式待办进入 `BACKLOG.md`。

- 2026-10-10 用户确认退役「重温收藏」（ADR 0049）：移除洞察页双流、专用算法 / 反馈 / 组件 / 开发预览 / 双语资源与测试。搜索、Ask、Related Stars、Quick Look Memory 和个人记忆统计保留；见 `logs/2026-10-10-retire-resurface.md`。

- 2026-10-09 第二版文案已落地，中文更新 186 条、英文 182 条；保留 Star / Provider / API Key / Topic / Fork / README / 模型 ID 等准确名称与既有产品概念。完整对照见 `knowledge/reviews/2026-10-09-copy-review.md`；用户已确认长提示拆短句、可自行部署及登录隐私范围。相关组件测试和局部 Biome 通过，见当日日志。

- 洞察页用户面名称统一为 Insights / 洞察（侧栏、页面标题、登录卖点）；侧栏顺序为浏览 → 洞察 → 集合；内部路由仍为 `/dashboard`。见 `contracts/conventions.md`、`contracts/ui-ux.md` 与 `logs/2026-09-20-insights-nav-label.md`。
- 标题与说明是同一簇：标题↔说明 xs / `gap-1`（4px），簇→正文 lg / `gap-4`，内容页区块之间 2xl / `gap-6`。组件为 `PageHeader`（h1）与 `SectionHeader`（h2）。见 `contracts/ui-ux.md` § Spacing 与 `logs/2026-09-20-heading-cluster-spacing.md`。
- 标题层级已统一为三级（页面标题 24px/Bold、区块标题 20px/SemiBold、卡片标题 16px/SemiBold），滚动条槽位已常驻预留（`.asterism-scroll-gutter`），规范见 `contracts/ui-ux.md` § Typography 与 § Scrollbar；浏览器视觉验证由维护者自行完成，见 `logs/2026-09-19-heading-hierarchy-consistency.md`。
- 当前产品定义与 Memory 术语见 ADR 0037、`contracts/product.md` 和 `contracts/data-model.md`。
- GitHub #40 Resurface 曾交付并验收关闭；2026-10-10 按 ADR 0049 退役，`/dev/resurface-preview` 已移除。
- GitHub #41 Ask Asterism 已交付并真实环境验收关闭（ADR 0042 / 0044 / 0045 / 0046）；`/dev/ask-preview` 支持无后端下交互状态与预览。
- ADR 0038 确认干净切换：没有旧 Note 用户数据，不做 Note 迁移，也不兼容 v1/v2 JSON。
- `knowledge/proposals/asterism-transformation-roadmap.md` 保存 Phase 0–9 的完整构想，冲突时以 Contracts 和 Accepted ADR 为准。
- 本机没有可用 Docker；数据库 migration / RLS / pgTAP 通过 GitHub Actions 或真实 Supabase 环境验证。
- 浏览器 embedding 资产仍由 `apps/web/scripts/prepare-embedding-assets.mjs` 管理；构建可使用现有缓存，受限网络下的降级方式见 `apps/web/EMBEDDING_ASSETS.md`。
