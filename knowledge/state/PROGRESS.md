# PROGRESS · 项目进度与恢复点

> 这里只记录当前状态、已完成里程碑和下一恢复点。详细执行历史见 `knowledge/logs/`，决策理由见 `knowledge/decisions/`，开放项见 `BACKLOG.md`。

## 当前状态

- **产品定位**：Personal Open Source Memory（ADR 0037）。Asterism 是开源、可自部署的个人开源软件记忆库，GitHub Stars 是首个来源。
- **当前状态**：GitHub #41 Ask Asterism 本地实现交付：BYOK 生成（客户端存 key + 无状态 `ask-generate` 代理）、个人库词法/语义召回、引用校验、Settings 配置与同意流、Command Palette 面板、双语 i18n 与 dev 预览路由全部落地；四道门禁与 impeccable 视觉检查（桌面明暗 + 移动 + 检测器零发现）通过。待办：远端部署 `ask-generate`、真实账号 smoke 与 production 验收后关闭 issue。
- **当前工程 frontier**：三个纵向切片中的 #39、#40 已完成；#41（Ask Asterism 私有问答）本地实现已交付（ADR 0042：客户端 BYOK + 无状态代理 + 引用校验、无抽取式兜底），剩余远端部署与真实环境验收。
- **本轮边界**：保持个人库私有优先；检索与问答不接入外网，不凭空生成虚假推荐。
- **延后方向**：Extension / Desktop 等待核心检索与交互稳定后再启动。AI 自动联网搜索、Snapshot 追踪、Research Session、MCP 暂未进入开发。

## 已完成里程碑

- **2026-09-20 · Ask 第二问死锁修复**：smoke 发现同一面板会话内第二问（追问 / 重试）永远停在 recalling——提交 id 未自增被防重入守卫吞掉；连带修复 `isSearching` 防抖窗口失真导致的语义通道静默绕过，并为 `useAskQuestion` 编排层补首批回归测试（3 例）。见 `logs/2026-09-20-ask-second-question-deadlock.md`。
- **2026-09-20 · Ask Asterism 本地实现交付（GitHub #41）**：BYOK 问答全链路本地落地——`@asterism/core` 召回 / prompt / 引用校验（16 单测）、`ask-generate` 无状态 Edge Function（8 单测）、db 封装（5 单测）、BYOK 存储与 Settings 同意流、Command Palette 面板（6+4 单测）、双语 i18n 与 `/dev/ask-preview`；四道门禁与视觉检查通过。远端部署与验收待维护者执行。见 `logs/2026-09-20-ask-asterism-delivery.md`。
- **2026-09-20 · Ask 连接管理器还原（ADR 0043）**：自旧 Generation Registry（`edb5925~1`）完整迁移连接配置体验——具名连接管理、模型检测（`/models` 转发，失败手填）、连接探针、活跃连接与「包含笔记」偏好；底座重建为浏览器本地连接库（版本化 localStorage 键），`ask-generate` 增加 `models` / `test` 两个动作（部署面不新增函数行），激活连接经 ADR 0042 出网同意后写入 ask-byok。四道门禁全绿。见 ADR 0043 与 `logs/2026-09-20-ask-connection-restoration.md`。
- **2026-09-19 · Ask BYOK 决策与 #41 前置准备**：裁定 Ask Asterism 生成策略为客户端 BYOK（OpenAI 兼容、Provider 白名单）+ 无状态 Edge Function `ask-generate` 透传 + 客户端引用校验，不做抽取式兜底；修订 product / architecture / data-model 三份合同的数据流与服务端 AI 边界表述，#41 验收标准追加 BYOK 四项，产出五步实现执行计划。见 ADR 0042 与 `logs/2026-09-19-ask-byok-preparation.md`。
- **2026-09-19 · Resurface 真实环境验收与 #40 关闭**：Vercel production（git 集成自动部署，无自定义域名）在真实账号下确认 Dashboard Resurface 双流、可验证理由、Useful / Dismiss 持久化与 Quick Look Memory 入口；QA 产生的本地反馈已清理还原，issue #40 附验收评论后关闭。见 `logs/2026-09-19-resurface-production-acceptance.md`。
- **2026-09-19 · Resurface & Memory Streams 交付（GitHub #40）**：沉睡唤醒双流、可解释推荐理由、记忆回显与补写入口、Useful / Dismiss 本地反馈；`packages/core` 算法 + 20 单测、web 组件与交互测试、双语 i18n、dev 预览路由与四道门禁全部通过。见 ADR 0041 与 `logs/2026-09-19-resurface-memory-streams.md`。
- **2026-09-18 · 导入 / 导出并排卡片等高**：栅格去掉 `items-start` 让两张卡拉到同一行高，拖拽区用 `flex-1` 吃掉剩余高度（原来底部留 145px 空白），骨架同步。见 `logs/2026-09-18-import-export-card-heights.md`。
- **2026-09-18 · Favicon 源资源**：新增小尺寸专用 `favicon.svg`（与 BrandLogo 同拓扑、按 16px 重调字重、主题色字面值）与 `favicon-tile.svg`（应用图标位），接上 `index.html` 的图标声明，并用 `scripts/sync-public.mjs` 解决 `apps/web/public` 未被服务的问题（`publicDir` 被 embedding 资产占用）。RealFaviconGenerator 产出的整套图标（透明标签页图标 + 白底主屏图标 + `site.webmanifest`）已落地 `apps/web/public` 并接入 `index.html`。见 `logs/2026-09-18-favicon-assets.md`。
- **2026-09-18 · Browse 列表动态列行距**：列表视图「动态」列的 `更新于 / 收藏于` 两行原本零间距贴在一起，补 4px 行间距（字号 / 行高 token 不变），行高仍为 64px。见 `logs/2026-09-18-repo-table-activity-rhythm.md`。
- **2026-09-18 · 设置页语义搜索行重构**：状态（就绪 / 准备中 / 需要处理）移出动作区与行标题同行，维护动作统一按钮几何并区分常规与销毁层级，`重建索引` / `重试` 补上按钮内 pending 反馈，未同步仓库时就地归因；确认对话框关闭按钮补齐 i18n 与 pending 禁用。同日复核补完三项：描述文案去除 RLS 术语、pending 文案收短消除按钮被永久撑宽（`重建索引` 122.6 → 100px）、控件高度收敛尝试后回退（GlassRail 保留自带轨道高度，不强行与表单控件等高）。见 `logs/2026-09-18-settings-semantic-search-row.md`。
- **2026-09-18 · Browse 筛选栏控件几何统一**：facet、集合、更多筛选与排序改用同一份 trigger 几何常量（高度 / 圆角 / 内边距 / gap / 宽度区间 / 图标与箭头颜色），修复更多筛选文案居中、排序 Select 过宽且图标与文案之间留大片空白；排序控件移回独立右侧组并补可访问名。见 `logs/2026-09-18-filter-toolbar-trigger-geometry.md`。
- **2026-09-18 · 客户端偏好持久化修复**：主题在首帧脚本中应用，消除刷新时的亮暗闪烁；界面语言写入 `asterism-language` 并跨会话恢复。见 ADR 0040 与 `logs/2026-09-18-client-preference-persistence.md`。
- **2026-09-18 · Unified Retrieval Engine 复核收口（GitHub #39）**：在原交付基础上修正跨结果个人字段排序、不可达降级分支、不可证实的 Memory 语义归因和无关 Memory 存在加成；Related Stars 降级只由 Topic / Memory 词交集建立候选，同语言仅作同级排序；embedding consent 升级为 v2 并明确本地处理 / RLS 派生向量边界；解释徽章补齐 token、键盘和批量选择语义。见 ADR 0039 与 `logs/2026-09-18-unified-retrieval-review-remediation.md`。
- **2026-09-17 · Memory Foundation 交付与上线（GitHub #37）**：每个 `user × repo` 一条 Memory，承载 `whySaved` 与 `note`；Stars 同步幂等补齐基础 Memory，Quick Look 提供双字段编辑、清空、失败恢复与双语界面，导入导出升级为仅支持 JSON v3。自动化门禁与桌面/手机视觉 QA 通过；远端 Supabase migration 与 Edge Function 已部署上线，代码合入 `main`，#37 正式关闭。见 ADR 0038 与 `logs/2026-09-17-memory-foundation.md`。
- **2026-09-17 · 产品转向**：保存长期提案，发布 #36 / #37，接受 ADR 0037，统一 Product / Architecture / Data Model / UI-UX Contracts、Roadmap、README 与公开文案。Collection 降为次级人工组织能力，Memory Foundation 成为 frontier。见 `logs/2026-09-17-memory-transformation-issues.md` 与 `logs/2026-09-17-personal-open-source-memory-repositioning.md`。
- **2026-09-17 · 起步基线清理**：GitHub #38 修复退役 RPC pgTAP 调用与测试污染，移除过期 retrieval scratch，阻止 DEV corpus lab 进入生产包，并消除测试 storage 警告。见 `logs/2026-09-17-clean-pre-pivot-baseline.md`。
- **2026-08-27 · Collection Dial 退役**：ADR 0036 删除专用用户面、账本与 Undo；canonical Collection 数据和通用受信 mutation 保留。
- **2026-08-19 · Tag 退役**：ADR 0035 将 Tag 合并进 Collection，用户组织关系统一为 Collection。
- **2026-08-05 · AI 整理退役**：ADR 0032 删除服务端 BYOK Generation 与 AI Organization，保留可靠手动批量整理。
- **2026-07-27 · Retrieval 基础完成**：浏览器内 embedding、隐形混合搜索与 Related Stars 落地；二维星图按 ADR 0028 删除。
- **2026-07-18 · Phase 1 Web MVP 完成**：登录、同步、浏览、筛选、Collection、Note、统计、导入导出、写失败恢复和四道工程门禁完成。
- **2026-06-29 · Phase 0 完成**：Monorepo、共享包、Supabase、OAuth 与 CI 骨架验收。

## 下一恢复点

1. #41 收尾：ADR 0043 版 `ask-generate`（含 `models` / `test` 动作）已于 2026-09-20 重新部署至 `hqtrmulypxwdqvzlkhke`，传输层 smoke 通过（OPTIONS 预检 200；无 JWT / 伪造 JWT 均被平台 `verify_jwt` 拒绝）。Ask 第二问死锁已修复（本地代码待合入部署）。剩余：维护者在 Web 端真实账号 smoke——Settings 建立连接并检测模型 → 激活（过出网同意）→ ⌘K 提问（含**追问与重试**各一次，验证死锁修复）→ 引用直达 Quick Look → 无匹配问题返回「未找到」——验收通过后附 issue 评论关闭 #41，并同步本文件与 BACKLOG。

## 环境提示

- 本机当前没有可用 Docker，因此 `pnpm test:db` 需由 GitHub Actions 的本地 Supabase job 验证。
- 维护者 Supabase project ref 为 `hqtrmulypxwdqvzlkhke`；任何远端 migration / function 变更都需按 runbook 显式部署与 smoke，不因本地代码提交自动生效。
