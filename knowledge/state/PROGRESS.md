# PROGRESS · 项目进度与恢复点

> 这里只记录当前状态、已完成里程碑和下一恢复点。详细执行历史见 `knowledge/logs/`，决策理由见 `knowledge/decisions/`，开放项见 `BACKLOG.md`。

## 当前状态

- **产品定位**：Personal Open Source Memory（ADR 0037）。Asterism 是开源、可自部署的个人开源软件记忆库，GitHub Stars 是首个来源。
- **Star 同步与历史（ADR 0047）**：本地实现已完成完整快照对账、加密保存 GitHub 连接、开站静默同步、定时同步配置，以及 Browse 历史入口。取消 Star 保留 Memory 与 Collection，再次 Star 回到当前列表。待部署两项 migration、`sync-stars` Edge Function、Secrets/Cron 和 Web，并以真实账号验收。
- **当前状态**：GitHub #41 Ask Asterism 已从固定 top-K RAG 重构为目录常驻浅层 Agent（ADR 0045）：全库目录作稳定前缀，本地 `filter` / `search` / `expand`，read gate 校验 `repoId`。ADR 0046 撤销了 0045 的能力分级与同意重签——Agent 是唯一路径，固定召回流程已删除，`test` 回到纯连通性检测，旧同意向前迁移。待办：重新部署 `ask-generate` 与 Web，再用真实账号 smoke 后关闭 issue。
- **当前工程 frontier**：三个纵向切片中的 #39、#40 已完成；#41（Ask Asterism 私有问答）本地实现已交付（ADR 0042 / 0044 / 0045：目录常驻 Agent + 客户端 BYOK + 无状态 SSE 代理 + read gate、无抽取式兜底），剩余远端部署与真实环境验收。
- **本轮边界**：保持个人库私有优先；检索与问答不接入外网，不凭空生成虚假推荐。
- **延后方向**：Extension / Desktop 等待核心检索与交互稳定后再启动。AI 自动联网搜索、Snapshot 追踪、Research Session、MCP 暂未进入开发。

## 已完成里程碑

- **2026-09-22 · 顶栏与浏览页工具栏极简化清理**：按用户诉求移除 Browse 工具栏的「当前 Star / 历史」切换按钮，恢复纯净单一的 Star 列表浏览；彻底移除 Topbar 常驻的同步/重连按钮，日常同步完全由开站静默同步与后台定时任务驱动；手动同步与重新连接入口收敛至 UserMenu（用户头像菜单）中，消除顶栏视觉打扰。四道工程门禁全绿。见 `logs/2026-09-22-simplify-topbar-and-browse-toolbar.md`。

- **2026-09-22 · Star 完整同步与可找回历史本地实现**：移除增量截断，完整分页后在单事务中对账；持久化加密 GitHub 凭据；历史仓库在 Browse、Collection、Ask 与导入导出中可找回。TypeScript 类型检查、Core/DB/Web 单测与 Biome 通过；数据库 pgTAP 和远端验收待有 Supabase 环境时执行。见 ADR 0047 与 `logs/2026-09-22-star-snapshot-and-history.md`。

- **2026-09-22 · 下拉菜单与浮层 Trigger 激活态统一优化**：解决设置页 AI 连接卡片更多按钮点击弹出浮层时无激活态问题；在 `packages/ui` 中将 `data-[state=open]` 与 `aria-expanded` 属性映射至 `buttonVariants`（`ghost`、`outline`、`secondary`、`default`）；升级 `SelectTrigger` 增加展开态边框与底色反馈；在 Browse 筛选栏（`FILTER_TRIGGER_CLASS`、`FILTER_TRIGGER_ACTIVE_CLASS`）、集合卡片操作按钮与 Ask 模型选择器上系统性补齐展开激活视觉；全库 53 套件 279 项单测、类型与 Biome 门禁全绿。见 `logs/2026-09-22-dropdown-and-trigger-active-states.md`。

- **2026-09-22 · Ask 对话展开收起重构与水平 { 状渐变流光拱落地**：按用户草图精准实现横跨输入框上方（宽达 88%）、形如水平横卧大括号 `{` 的高阶渐变流光拱（`AskLuminousBracket`）；贝塞尔双曲波浪两翼贴输入框平滑淡出，中央汇聚为向上微尖角与微星聚光点；融合双层冷晶发光材质（高斯模糊电光蓝光晕 + 晶莹白金渐变高光脊线）；提供全域点击展开热区与悬停上浮呼吸；彻底废除右上角违和关闭按钮，实现点击外部空白处（Click Outside）与按 Esc 键可逆收起、再次按 Esc 彻底清空；输入框重新聚焦或提交自动展开。双语 i18n、ui-ux 契约、272 项全库单测与代码门禁全部通过。见 `logs/2026-09-22-ask-horizontal-luminous-bracket.md`。

- **2026-09-22 · Ask 对话舱右侧内容区居中与分层响应式宽度重构**：针对桌面端左侧边栏（`w-60` = 240px）导致的“整屏居中视觉向左偏离 120px”问题，将 AskDock 根节点与流体氛围层定位约束至右侧主工作区（`fixed bottom-0 right-0 left-0 lg:left-60`），实现与星标卡片网格的完美垂直对齐，并保护边栏导航不受遮罩污染；建立分层响应式宽度体系（未激活胶囊 `max-w-xl xl:max-w-2xl`，展开气泡流 `max-w-2xl xl:max-w-3xl`），保障最佳单行阅读行宽与仓库推荐卡片横向舒展排布；精调气泡内部动态比例（用户 80% 自适应贴右 vs 助手 92% 舒展贴左）；纵向高度增至 `36rem`。ui-ux 契约、272 项全库单测与代码门禁全部通过。见 `logs/2026-09-22-ask-content-center-and-width-system.md`。

- **2026-09-22 · Ask 对话双侧气泡与 Liquid Glass 流体毛玻璃质感升级**：根据用户期望将 Ask 对话重构为纯气泡交互体系（彻底去掉包裹对话的外层硬大框，气泡直接悬浮在页面上方；用户石墨蓝微渐变流体气泡靠右，Asterism 晶莹液态毛玻璃气泡靠左包裹 Markdown 回答与内嵌微毛玻璃卡片）；右上角悬浮轻量关闭胶囊；气泡与底部输入框采用 `backdrop-blur-2xl` + `backdrop-saturate-[190%]` + 渐变半透明底与高光反射线。契约、单测与门禁全部通过。见 `logs/2026-09-22-ask-dual-bubble-liquid-glass.md`。

- **2026-09-21 · Ask AI 连接与模型选择体验深度优化**：精简 Provider 为 OpenAI 与 DeepSeek；去掉自定义连接名称；添加连接弹窗内建测试门禁（测试通过才允许保存）；连接卡片增加直达测试按钮；测试时自动发现可用模型；底部 Ask 胶囊输入框支持实时切换模型（合并可用配置已发现模型）。见 `logs/2026-09-21-ask-connection-and-model-ux-optimization.md`。

- **2026-09-21 · Ask 输入框占位文案调整**：底部 Ask dock 输入框占位文案统一为「Ask Asterism…」，中英文语言包同步对齐。见 `logs/2026-09-21-ask-input-placeholder.md`。

- **2026-09-21 · CI 数据库测试自 Memory Foundation 起持续失败**：`memories` / `user_repo_embeddings` 只有 RLS、没有表级 GRANT。本地 / CI 的 `authenticated` 读 `memories` 被拒，`memory_foundation.test.sql` 计划 8 跑 4。补 `20260921120000_grant_client_memory_tables.sql`。远端仍需 `db push`。见 `logs/2026-09-21-ci-memories-table-grant.md`。

- **2026-09-21 · 撤销 Ask 的能力分级与同意重签（ADR 0046）**：静默降级让既有连接在部署瞬间退回更差的固定召回路径，同意重签在单用户自部署下只制造中断。删除固定召回全部代码，`test` 回到单次连通性检测，旧同意向前迁移。见 ADR 0046 与 `logs/2026-09-21-ask-drop-capability-gate.md`。

- **2026-09-21 · Ask 改为目录常驻 Agent（ADR 0045）**：摘除 Ask 对 embedding 与固定 top-K 的依赖；三档目录 + 本地穷举工具 + read gate + 可续接预算。修订 product / architecture / data-model / ui-ux。见 ADR 0045 与 `logs/2026-09-21-ask-catalog-resident-agent.md`。

- **2026-09-21 · Ask 回答流式化（ADR 0044）**：生成契约从严格 JSON 改为 Markdown 正文 + `asterism-recommendations` 哨兵块；`ask-generate` 把上游 SSE 转为 Asterism 协议；超时拆成响应头 / 空闲；前端 `StreamingMarkdown` 隔离 `@lobehub/streamdown`。四道门禁全绿。见 ADR 0044 与 `logs/2026-09-21-ask-streaming-markdown.md`。

- **2026-09-20 · Ask 底部输入区胶囊化**：移除未提问时的上方大白框与 emptyHint，输入框去除多层包裹改为独立的 `rounded-full` 胶囊（pill composer）；问答在上方以 `rounded-2xl` 独立卡片展开，支持右上角关闭或 Esc 收起。四道门禁全绿。见 `logs/2026-09-20-ask-dock-pill-composer.md`。

- **2026-09-20 · Ask Bugbot 修复**：v1 出网同意升级时绑定到现有连接，不再只删快照导致 Ask 失效；dock 保持浮层 overlay，仅让舱体外点击穿透，不把主内容顶上去。见 `logs/2026-09-20-ask-bugbot-findings.md`。

- **2026-09-20 · Ask 常驻底部输入区**：Ask 从唤起式 Dialog 改为 App Shell 内常驻的非模态底部输入区；⌘K / Ctrl K 只聚焦 composer，顶栏入口移除。四道门禁全绿，answered / idle 预览视觉检查通过。见 `logs/2026-09-20-ask-persistent-bottom-dock.md`。

- **2026-09-20 · #36 以来的代码复核与整改**：对产品转向至今的改动做系统复核并逐项整改。根因是一条贯穿性的「双份存储」反模式，
  统一改为单一真相源：BYOK 只存同意、key 运行时从连接库解析（轮换 / 停用即时生效）；`ask-generate` 补 `max_tokens`、
  `redirect: 'manual'`、原型安全的 provider 查表与可配 CORS；`saveMemory` 改条件 upsert，`source_created_at` 回填下推为
  `ensure_user_memories` SQL 函数；删除 note-repo-ids 冗余查询消除检索竞态；语义近邻抽出可复用索引（归一化 + Top-K 记忆化），
  切换锚点不再全量重扫；`repo-inspector.tsx`（1265→754）与 `repos/ask.ts`（571→72）按职责拆分。四道门禁全绿。
  见 `logs/2026-09-20-pivot-review-remediation.md`。
- **2026-09-21 · Ask 设置项精简（移除活跃连接与模型冗余项）**：Ask 底部输入框已具备跨 Provider 已验证模型直接切换并自动绑定连接的能力，Settings 底部的「活跃连接」下拉与「模型」展示行彻底移除，偏好卡片仅保留「在 Ask 上下文中包含笔记」；连接列表保持完全纯净，不额外增设状态标签。四道门禁全绿。见 `logs/2026-09-21-simplify-ask-connection-settings.md`。
- **2026-09-20 · 标题簇间距统一**：标题与说明收成 xs（4px）一簇，簇到正文 lg，内容页区块 2xl；Ask 去掉叠层的「生成连接」标题。见 `logs/2026-09-20-heading-cluster-spacing.md`。

- **2026-09-20 · 洞察页名称统一**：侧栏、页面标题与登录卖点统一为 Insights / 洞察，不再对用户露出 Dashboard / 仪表盘；侧栏顺序改为浏览 → 洞察 → 集合；内部路由仍为 `/dashboard`。见 `logs/2026-09-20-insights-nav-label.md`。
- **2026-09-20 · Ask 面板底部对话舱重设计**：Ask 弹层从 Command Palette 式改为对话式底部 dock（composer 舱底直输、消息向上逐条弹出、用户气泡靠右 / Agent 纯文本靠左、遮罩减淡 30%、玻璃关闭小按钮）；`DialogContent` 增加 `overlayClassName`；修复 React 19.2 StrictMode + Portal 下挂载期 effect 早于 ref 附加导致的贴底滚动失效（改走 ref callback）；`/dev/ask-preview` 支持真实壳层逐状态预览；双语 i18n、253 单测、明暗 + 移动视觉检查全绿。见 `logs/2026-09-20-ask-bottom-dock-redesign.md` 与 ui-ux 契约「Ask 对话舱例外」。

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

1. #41 收尾：目录常驻 Agent（ADR 0045 / 0046）本地已交付。剩余：重新部署 `ask-generate`（`tool` 角色、消息上限、`tools` 透传、SSE `tool_call`）与 Web，维护者用真实账号 smoke——既有连接与既有同意应当无需任何手工操作即可继续提问 → ⌘K 提问（确认目录可见、工具轮次、正文流式、停止生成、追问、预算耗尽后继续深入）→ 引用直达 Quick Look → 空库返回「未找到」且不与预算耗尽混淆——验收通过后附 issue 评论关闭 #41，并同步本文件与 BACKLOG。

## 环境提示

- 本机当前没有可用 Docker，因此 `pnpm test:db` 需由 GitHub Actions 的本地 Supabase job 验证。
- 维护者 Supabase project ref 为 `hqtrmulypxwdqvzlkhke`；任何远端 migration / function 变更都需按 runbook 显式部署与 smoke，不因本地代码提交自动生效。
