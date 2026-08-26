# NOTES · 工作便签

- **Collection Dial 产品退役（2026-08-27，ADR 0036）**：用户面、Undo RPC/列、Dial 账本行与 `p_item_repo_ids` 已删除。Quick Look / 批量对话框 / relation head 写入缝保留。embedding 仍服务 Related Stars 与隐形混合搜索。远端需维护者 apply `20260827000000` 并部署 `bulk-organize`；本轮不自动 push。

- **#31 单项生产 Collection Dial（2026-08-13）**：生产入口只位于 Browse 的 grid / list Grip，独立 core reducer 持有冻结 scope、候选和恢复状态，共享 `packages/ui` 组件保持 controlled。候选最多 7 个，排除已包含单仓库的集合，稳定顺序为 session MRU → `updatedAt` → NFKC 小写名称 → ID。拿起可由 Space 或 Grip 指针跨过 7px 触发；触控只允许 44px Grip，目标 pointerup 一步确认，点击 / Q/E 仅选择，Enter / 明确按钮确认，取消与路由卸载不写入。Quick Look 脏笔记拒绝关闭时拿起中止并保留草稿与焦点。写入走 `collection_dial` 持久 operation 与 client request idempotency，服务端结果和 query 收敛前不宣告成功；可重试 / 终止失败保留冻结 scope 与 target。下一 ticket 是 #32，不得提前加入 More / New / Undo。该能力已由 ADR 0036 退役。

- **#30 受信集合关系 mutation seam（2026-08-12）**：`20260812120000_trusted_collection_relation_mutations.sql` 回填既有 membership 为不隶属 operation 的 baseline head，并让每次真实 collection add/remove 在受信事务中推进 version + UUID receipt；no-op 不推进。Quick Look / import 走 authenticated `mutate_collection_relation` 并形成单项 operation / item，bulk executor 走 service-role `apply_collection_relation_mutation`；普通客户端不再直写 `collection_repos`。Bulk operation 已增加 interaction / 绑定规范化 payload 的 UUID client request idempotency / Undo 预留字段，item 持久化严格 `effective_changed` / mutation UUID / relation version receipt；响应丢失后的单项请求或 worker 重领保留原 operation 与完整 receipt，同 key 换 payload 被拒绝。`pnpm test:db` pgTAP 门禁在 CI 本地 Supabase 上自动覆盖真实并发、baseline/no-op、响应丢失与授权失败；当前未推送 migration 或部署函数，本机无 Docker，故未在本机会话执行数据库门禁。下一 ticket 是 #31，不得提前实现多选、More / New 或 Undo。

- **ADR 0035 退役用户自定义 Tag（2026-08-19）**：cutover 已落地。本机无 Docker，未跑 pgTAP / 本地 apply，未部署远端。下一 frontier 为 Phase 3 浏览器扩展；不要按「页内打标签」实现。

- **Collection Dial ticket chain（更新于 2026-08-19）**：原生线性依赖为 #30 → #31 → #32 → #33 → #34。#30–#34 均已关闭，规格父票 #29 同日关闭并摘掉 `ready-for-agent`；验收中发现的问题延后另开 ticket。Collection Dial 已无未关 issue，下一 frontier 为 Phase 3。

- **Collection Dial buildable spec（2026-08-12，GitHub #29 / ADR 0034）**：单项和多选都走持久 `bulk-organize` lifecycle；candidate snapshot 最多提供 7 个 quick targets，范围 >50、embedding 不可用或多选无简单多数共识时静默使用 session MRU + stable order。More 只从冻结 catalog 选目标，New 创建成功后立即对原 scope 发起 add，关系失败不得重复创建集合。Undo 服务端窗口为 30 秒，只反转成功 item 中 `effective_changed=true` 且当前 collection relation head 仍匹配 receipt 的关系。下一步 `/to-tickets` 必须先向用户确认 ticket 粒度和 blocking edges，获批前不发布 tickets。

- **Collection Dial verdict（2026-08-12，ADR 0033）**：用户接受当前底部半圆集合盘方向并批准进入真实实现规格。接受项包括文件夹容器 / 打开接收态、active 居中、透明渐变模糊、选择与确认分离、直接拖放、集中异步反馈和宽屏 / 窄屏奇数窗口。桌面连续 10 项、移动连续 5 项没有独立测量记录，「更多集合」与「新建集合」也尚未在原型实现；不得把它们写成已验证，须在 `/to-spec` 中转为明确的生产验收。原型继续保持 dev-only、内存假数据和模拟写入，不直接升级为生产组件。

- **Collection Dial 文件夹图标替换（2026-08-12）**：用户明确要求使用其下载的 Vecteezy 简约文件夹原素材，不采用 3D / 拟物或重新绘制方案。闭合 / 打开状态现直接使用从 EPS 原件提取并等比映射的 SVG Bézier 路径，JPG→PNG 的临时栅格方案因界面缩放发虚已删除；原轮廓与高光分层保持不变，黄色阶映射到 Asterism 浅蓝色阶。闭合状态没有纸张或内衬色带；背板作为底层延伸到前片后方，再由前片覆盖，因而与原版一样直接相接且在暗色主题不透底。当前目标完整显色，其他集合降低饱和度和不透明度。独立绘制在图标下方的椭圆落地阴影已完全移除，素材自身的弧形明暗层保留。选择、拖放、键盘及响应式状态机不变。

- **Collection Dial P1 收敛（2026-08-11）**：点击文件夹与 Q/E 现只更新目标，不再隐式提交；提交统一由 Enter 或明确 `Add to …` 按钮触发，直接拖拽松手仍保留一步投放。底部空间由文件夹弧形排布建立半圆感，背景使用从完全透明过渡到半透明的磨砂模糊层，不绘制实体 basin / rim；文件夹与标签的旋转 / 缩放解耦，标签保持水平可读。左右悬浮箭头因与可点击文件夹重复而移除，Q/E 收入位置反馈旁作为桌面键盘提示，移动端隐藏提示。选中任意可见文件夹后，该项始终沿轨道转入中央，其余项按相对距离平移、旋转、缩放并在边缘淡出；序列不循环，边界附近允许可见项减少。盘面集中显示 `仓库 → 集合`、`当前位置 / 总数`、pending / success / failure、Cancel、Retry 与 Undo；模拟失败首次 Retry 可恢复，Reset 回到默认 Frontend。桌面显示最多 7 项、390px 显示最多 3 项，明暗主题、点击只选择、按钮提交、Q/E + Enter、首次失败后 Retry、真实拖拽松手与控制台均已在真实浏览器核验。当时尚待用户形成 verdict；该恢复点已由 2026-08-12 的 ADR 0033 收口，未完成的连续任务与 More / New 验证转入生产验收。

- **Collection Dial 拟真方向纠偏（2026-08-10）**：用户明确否决原型把“弧形”理解为弯曲排列的普通卡片，目标是具有真实容器感的半圆集合盘。集合现在表现为有背板、纸张、内部暗部与可翻转前片的实体文件夹；拖动仓库靠近时目标抬升并张开，松手后仓库缩小吸入，离开则合拢。集合沿半圆轨道排布，但不再用可见半圆外框包围，改由页面底部渐变、局部模糊与柔和地面阴影建立空间；非目标文件夹使用石墨中性色，只有当前张开的目标着蓝。显式 `Drop here`、关闭按钮、盘面上方仓库名与操作提示均已从视觉层移除，松手直接投放，点选仓库后点击文件夹作为触控等价路径，键盘使用 Q/E + Enter 投放、Escape 取消；不可见的 ARIA live 继续播报状态，失败重试因承担必要恢复职责继续保留。可见集合按容器宽度使用奇数窗口：宽屏 7、常规桌面 / 平板 5、手机 3；窗口在 Q/E 越过边缘时跟随目标平滑滑动，保持当前集合可见并尽量居中。明暗主题、失败保留与单次 Undo 保持。原型入口收敛为 `/?prototype=collection-dial`，旧 `variant` 参数不再改变表现。

- **Collection Dial 对齐完成并确认（2026-08-06）**：当前方向不是恢复已退役的 AI 整理任务，而是让用户从 Browse 卡片 / 列表直接拖动仓库；越过拖动阈值后，底部临时出现弧形 **集合盘（Collection Dial）**，以一个 active 集合为当前投放目标，并由左手 `Q` / `E` 转动切换。浏览器内推荐预测用户当前最可能选择的已有集合，只改变盘中顺序，不主动发起整理或修改 canonical；低置信度不冒充推荐。功能只服务集合，不混入标签；「建议集合」只是一种候选状态，「语义」不进入用户功能名。正常浏览拖动单项；只有已进入选择模式并拖动已选项时才拖动整个稳定选择范围。一次拖拽只加入一个集合，松开后结束；桌面可从非交互背景越过位移阈值启动，并在 hover / focus 时显示 Grip 暗示，移动端以常驻 Grip 为唯一拖动起点并保留点按等价路径，不用整卡长按。纯键盘以 Space 拿起、Q/E 转动、Enter 投放、Escape 取消，与指针共用状态机并经 ARIA live 播报。

  盘中同时显示 5 个位置（active 居中、左右各 2 个相邻项），Q/E 与鼠标共同改变同一个 active 状态，序列不首尾循环；快速序列最多 5 个已有集合，另有「更多集合」与「新建集合」，二者都会冻结当前范围并承接后续选择 / 创建，创建成功后自动加入。第一推荐默认 active；无可用候选时依次由「更多集合」或「新建集合」承接。只有在投放区内松开才提交，盘外松开或 Escape 取消。越过拖动阈值时生成并冻结候选快照，当前手势内不重排。Drop 后等待服务端权威成功再宣告完成，失败保留范围与目标供重试 / 取消；每次成功形成独立短期 Undo，连续成功可合并通知但不能偷换成整段会话回滚。单项快速推荐排除已加入集合；多选允许部分已有关系，只新增缺失关系并准确披露新增 / 已有数量。多选推荐聚合各仓库候选做共识投票，不平均异质选择范围；无清晰共识时不显示语义建议。

  语义不可用时不触发 opt-in，而是按最近使用与稳定顺序静默降级；空集合可用本地嵌入的名称 / 描述以较低权重参与。不新增推荐行为日志，只使用 canonical 关系和当前会话上下文；不用「AI」或 Sparkles 标记，高置信 active 最多显示克制的「建议」状态及可验证近邻理由。多选投放结束后恢复原选择范围；未完成批量操作期间阻止新的多选拖放，但不锁死普通单仓库拖放。原型及首个实现切片只覆盖 Browse；原型共享同一状态机，只比较浅弧卡槽、Dock 纵深和明显轮盘三种空间表现，并以真实连续桌面 / 移动任务、误触、Q/E 命中、更多 / 新建承接、失败 / Undo 可理解性形成明确 verdict。其他表面后续复用页面无关的推荐与写入边界。

- **Browse 选择入口与模式（2026-08-06）**：排序控件已并入 Language / Topic / More filters 的左侧筛选组；批量选择入口移动到筛选行右端。进入选择模式后，页面头部保持标题、视图切换、筛选与排序的稳定结构，选择数量、全选范围、整理、导出 / 清空与完成全部收拢到固定在内容视口底部的操作栏；桌面滚动、390px 窄屏及 en / zh-CN 已完成浏览器核验。见 `logs/2026-08-06-browse-selection-toolbar-layout.md` 与 `logs/2026-08-06-browse-selection-mode-redesign.md`。

- **本地 Supabase CLI（2026-08-06）**：仓库根 devDependency 已提供 `supabase@2.109.1`，并已通过 `pnpm exec supabase --version` 验证。Windows 环境不依赖全局 `supabase` 命令；当前仍缺 Docker，因此本地数据库启动与 migration smoke 仍需先补齐容器运行时。

- **AI 整理退役的远端收尾（2026-08-06）**：维护者项目 `hqtrmulypxwdqvzlkhke` 已应用 `20260804120000_organization_plan_review_execution.sql` 与 `20260805120000_remove_ai_organization.sql`，删除四个退役 Edge Functions 和四项 `AI_*` secrets，并部署不再依赖 AI 表的 `sync-stars` / `bulk-organize`。其他自托管环境仍须顺序重放历史 migration，再由退役 migration 收敛；不要删除历史 migration。见 ADR 0032 与 `logs/2026-08-06-retire-ai-organization-remote.md`。

> 持久状态层（Durable State）的"草稿纸"。模型没有跨会话记忆，本文件就是放在 **context 之外** 的便签：随手记下中途的发现、临时结论、易忘的指针，下次进来先扫一眼即可快速恢复状态。

## 如何使用本文件

- agent 在每轮 loop 中可随时往这里追加**短小的便签**：临时发现、待确认点、踩坑提醒、"为什么当时这么做"的备注。
- 与其他状态文件的分工：里程碑/阶段进度写 `PROGRESS.md`；正式待办与已知问题写 `BACKLOG.md`；重大且不可逆的决策写 `decisions/*` ADR；本文件只放**轻量、易变**的工作记忆。
- 过期或已沉淀进契约/ADR 的便签可以删除，保持本文件简短可读。

## 关键指针（决策与契约在哪）

- **#25 真实 smoke（2026-08-01）**：`manage-organization-tasks` 已部署至 Supabase project `hqtrmulypxwdqvzlkhke`，最终 Generation wire schema 为 `organization-generation-v3`（5 repo / page、紧凑 tuple、8,192 output tokens）。真实任务 `29b4c964-6aba-429c-aa4b-27707b499a37` 已到 `plan_ready`，Plan revision 1 / 242 actions / 1 conflict / 0 uncertainties；未 apply，canonical 未变化。reasoning model 可能把隐藏推理计入 completion budget，不能仅按可见 JSON 体积设置 output token。
- **#26 Plan Review / execution hand-off（2026-08-04）**：授权权威是稳定 Task 页的服务端 semantic group fingerprint，不是消息或客户端分类。已有分类新增低风险默认纳入；新建分类 / 移除必须显式批准。确认事务只建立唯一 `source: organization_task` bulk operation/items/link，不内联写 canonical；执行结果与 Task 状态必须从 ADR 0023 ledger 派生。完全相同确认可重放原 operation，任何 Plan / fingerprint / count 变化均冲突。部署与 smoke 清单见 `supabase/functions/manage-organization-tasks/README.md`，实现记录见 `logs/2026-08-04-issue-26-organization-plan-review-execution.md`。

- **Organization Task 部署（2026-07-28，#24）**：关联项目 `hqtrmulypxwdqvzlkhke` 已应用 `20260728180000_organization_tasks.sql` 与 `20260728183000_localized_organization_opportunity_goal.sql`，`manage-organization-tasks` 为 `ACTIVE v4`，更新后的 `sync-stars` 为 `ACTIVE v6`。新环境仍须按同一顺序迁移并部署两个函数。前者不需要 BYOK 加密 secret，不读取 credential，也不调用 Provider；缺少 active Generation Connection 时发现不会固化不完整披露。
- **Phase 2.1 tickets（更新于 2026-08-04）**：GitHub #23 已拆为 #24 → #25 → #26 → #27 → #28；#24、#25 已实现并关闭，#26 的开放 blocker 已归零且成为当前 frontier。后续不得把一次性 prototype 演化为生产代码，也不得提前实现 #27–#28。
- **决策（ADR）**：`knowledge/decisions/*` —— 一条决策一个文件，含背景/取舍/结论。
  - `0001-supabase-baas.md`：后端选 Supabase（Auth + Postgres + Edge Functions）；Realtime 部分由 ADR 0012 废止，pgvector 产品用途曾由 ADR 0022 移除、现由 ADR 0026 重新启用
  - `0012-remove-realtime-from-product-scope.md`：业务数据不做主动推送收敛，按查询边界读取 Postgres 最新状态
  - `0013-remove-dexie-offline-cache.md`：当前不承诺离线浏览；Postgres 是唯一持久化权威源，TanStack Query 只做会话内缓存
  - `0002-pnpm-over-bun.md`：工具链选 pnpm（而非 Bun）的取舍
  - `0003-commitlint-lefthook.md`：提交规范 + git 钩子方案
  - `0005-design-tokens-github-primer.md`：历史 Primer 配色（已被 ADR 0009 supersede；8px 圆角仍保留）
  - `0009-graphite-glass-visual-system.md`：当前石墨磨砂配色、玻璃边界与动效规则
  - `0018-typed-ai-provider-registry.md`：类型化 Generation Provider Registry，不把 Phase 2 做成完整 AI Gateway
  - `0024-custom-endpoint-ssrf-boundary.md`：自定义 endpoint SSRF 分类器守卫恒开 + 部署者域名 allowlist；HTTPS DNS-rebinding TOCTOU 为已知残余
  - `0022-remove-embedding-and-semantic-search.md`：移除 Embedding、pgvector 语义搜索与相关设置（**已被 ADR 0026 取代 / Superseded**，2026-07-23：0026 在其缝隙上以「多语言小模型 + 非 BYOK + 浏览器内 + 同源自托管」重新立项并 Accepted；0022 保留为历史背景）
  - `0026-ai-organization-flow-and-cluster-paradigm.md`：**检索优先范式（Accepted，2026-07-23）** —— 双平面、纯浏览器内 embedding 与隐形混合搜索继续有效；§8 全库涌现簇 + promotion 已由 ADR 0027 取代，§7 的二维语义星图已由 ADR 0028 取代。
  - `0027-local-semantic-neighborhoods-over-global-clusters.md`：**局部语义邻域（Accepted，2026-07-27）** —— 真实 518 条个人 Star 否定稳定、互斥、可命名的全库分区；Quick Look 改为最多 5 条互为 Top-12 近邻的 Related Stars，旧向量过滤、允许为空、不显示相似度百分比。
  - `0028-remove-semantic-star-map.md`：**移除语义星图（Accepted，2026-07-27）** —— 二维裸点云没有混合搜索与局部邻域之外的独占用户任务，并增加探针式判断、投影误读、位置漂移、维护与无障碍成本；正式 Browse 只保留卡片 / 列表，Asterism 星群继续作为品牌比喻。
  - `0019-biome-tailwind-v4-css.md`：Biome 2.5.1 统一检查 Tailwind v4 CSS，不引入 Stylelint
- **契约（什么是"对/完成"）**：`knowledge/contracts/*` —— `product` / `architecture` / `data-model` / `conventions` / `ui-ux`。
- **设计源（Design Source）**：`contracts/ui-ux.md` + ADR 0009 是当前视觉与 token 权威；Ardot 文件 `698428420561751` 仅保留为历史布局/间距参考。
- **路线图**：`knowledge/roadmap.md`（Phase 0–4）。
- **进度**：`knowledge/state/PROGRESS.md`；**待办**：`knowledge/state/BACKLOG.md`。
- **入口约定**：根 `AGENTS.md`（声明 `knowledge/` 为单一事实源）。

## 技术栈一句话

开源、可自部署的多端 GitHub Star 管理器：**TypeScript + React + Tailwind/shadcn-ui** 前端，**Supabase**（Auth/Postgres/Edge Functions）后端，TanStack Query 提供会话内请求缓存，**pnpm + Turborepo + Vite + Vitest + Biome** 为工具链；阶段顺序 Web → AI（BYOK）+ 批量整理 → 扩展 → 桌面（共享 `core`/`ui`/`db`）。

## Phase 0 脚手架便签

- **本地骨架已就位**：`pnpm install` 后，`pnpm dev`（turbo）可起各端；`apps/web` 用 `pnpm --filter @asterism/web dev`，其 `predev` 会先构建 workspace 依赖，避免被忽略的共享包 `dist` 过期。四道门：`pnpm lint` / `typecheck` / `test` / `build`。
- **依赖版本**：由 `pnpm add` 在 2026-06 解析（如 TS 6、Vite 8、Vitest 4、React 19、WXT 0.20.x），以 `pnpm-lock.yaml` 为准，未手写臆造版本。
- **恢复点**：下一步是凭据 handoff（Supabase + GitHub OAuth），见 `PROGRESS.md` 与 `logs/2026-06-29-phase0-scaffold.md`。

## 待办提醒（便签级）

- **#25 真实 smoke 恢复点（2026-08-01）**：测试任务 `1b32d025-f397-4663-a972-68b219a4d396` 已停在 `generation_paused`；134 候选 / 3 页，0 页成功，3 次初始调用累计 27,266 tokens。不要直接 Resume 消耗剩余 3 次 retry；先修复 50 仓库页面与 4,096 output-token 上限导致的截断 JSON，并让 UI 显示安全 error code，再新建任务重跑。客户端 `generation` / `plan` checkpoint 契约遗漏已在工作区修复但尚未提交。

- **Phase 2.1 一次性原型（2026-07-28，verdict 已获得）**：运行 `pnpm prototype:natural-ai`；同一 Browse 路由通过 `?variant=A|B|C` 比较引导式工作区 / 规划对话 / 整理控制台，通过 `?scenario=first|incremental` 比较首次历史大库 / 后续新增 Star。用户选择 B，理由是“对话形式更自然”。原型仍仅为开发态内存 stub，无 Provider / canonical 写入；后续规格以对话为主骨架，但必须为复杂审阅、进度与恢复提供不依赖聊天滚动的稳定任务面。完整原型应保留到 throwaway branch 后再从 main 清理 losing variants，不要直接把 B 的原型代码当作生产规格。证据与未决项见 `logs/2026-07-28-natural-ai-organization-prototype.md`。
- **浏览器 embedding 资产与实测（2026-07-24，#19）**：固定 `Xenova/multilingual-e5-small@761b726…` 的 q8 ONNX（118,308,185 bytes，SHA-256 `f80102d3…c193`），`@huggingface/transformers` 4.2.0；构建脚本写入忽略目录 `.cache/embedding-assets/v1/public`，运行期只从 `/models/` 与 `/embedding-runtime/` 同源读取，禁止远程模型。批量大小固定 16；真实 Chromium 暖缓存 WebGPU 16 条 454ms、WASM 236ms，本机虽 WASM 更快仍按契约 WebGPU 优先并可靠回退。资产来源与复现见 `apps/web/EMBEDDING_ASSETS.md`。
- **构建期取模型可走代理 / 镜像 / 可离线降级（2026-07-24）**：`prepare-embedding-assets.mjs` 是 `pnpm build`/`predev` 的前置步；Node 构建期 `fetch` **直连 `huggingface.co`、不读系统/OS/浏览器代理**（让内置 fetch 读代理的 `NODE_USE_ENV_PROXY` 要 Node 24+，本项目 Node 22；`undici` 的 `EnvHttpProxyAgent` 又因该包在 `apps/web` 解析不到而不可用），故即使浏览器能开 HF 也可能 `UND_ERR_CONNECT_TIMEOUT`（10s 连接超时，国内/受限网络典型）。三条降级路：①**代理** `HTTPS_PROXY`（及 `http_proxy`/`ALL_PROXY` 等常规变量）——脚本自读并用 Node 内置 `http` 的 `CONNECT` 隧道 + `tls` 转发下载（零新增依赖），如 `http://127.0.0.1:7890`；②**镜像** `HF_ENDPOINT` 或 `ASTERISM_MODEL_BASE`（如 `https://hf-mirror.com` 拉**真实资产**；脚本里 `ASTERISM_MODEL_BASE` 优先级高于 `HF_ENDPOINT`）；③**跳过** `ASTERISM_ALLOW_MISSING_EMBEDDING_ASSETS=1`（拿不到就打警告继续、产物运行时回退关键词搜索）。下载失败重试 3 次；SHA-256 失配仍硬失败（损坏而非缺网）。turbo.json 声明分工：改变产物的 `HF_ENDPOINT`/`ASTERISM_MODEL_BASE`/`ASTERISM_ALLOW_MISSING_EMBEDDING_ASSETS` 进 `build.env`（入缓存键），只改路由不改字节的代理变量进 `build.passThroughEnv`。详见 `apps/web/EMBEDDING_ASSETS.md`。
- **当前设计系统**（2026-07-10）：配色已从 Primer 改为 Graphite Glass（ADR 0009）；8px 圆角、Geist 字体与 4px 间距栅格不变。玻璃只用于交互层，背景无噪点，Logo 为单色电光蓝。
- **工作区根目录未迁移**：本次初始化**未执行 `move_agent_to_root`**，当前会话仍以原工作区根为准，仓库位于 `/Users/asherliao/Projects/asterism`。后续若需以该仓库为工作区根，再单独切换。
- **Edge Function 部署是「每环境手工一次」**（2026-06-30）：`sync-stars` 之前没部署导致 Sync 报 404，已 `supabase functions deploy sync-stars`（项目 `hqtrmulypxwdqvzlkhke`，现 `ACTIVE v1`）。换项目 / 新部署者必须重跑该命令，否则同步必报错。`supabase functions list/deploy --project-ref` 会生成 `supabase/.temp/`（已 gitignore）。`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` 由平台自动注入，无需手配 secret。
- **README Edge Function 已部署并验收**（2026-07-18）：当前 Supabase 环境已具备 `read-repo-readme`；授权、公开 fallback、无 README、非成员、限流、ETag 304 与真实复杂 README 路径均已验收。换项目 / 新环境仍需逐环境部署，边界见函数 README 与 ADR 0011。
- **Impeccable v3.9.1 项目级安装**（2026-07-10）：Codex skill 位于 `.agents/skills/impeccable/`，设计检测 hook 位于 `.codex/hooks.json`；由官方 CLI 管理。`apps/web/PRODUCT.md` / `DESIGN.md` 是对齐层，`knowledge/contracts/*` 仍为权威。
- **自定义 endpoint SSRF 已两层验证**（2026-07-20，ADR 0024）：托管 Supabase Edge Runtime 实测 `Deno.resolveDns` 可用、云 metadata 被平台挡，但 loopback / 私网出站会真实发起 → 必须自带分类器守卫。一次性探针函数已部署验证并删除（项目 `hqtrmulypxwdqvzlkhke` 现只剩 `sync-stars` / `read-repo-readme`）。本地原型（含分类器 `ssrf-guard.ts`）验证后已删除，答案固化进 ADR 0024，实现时按合同重建分类器。
- **`manage-ai-connections` 需逐环境部署且必配加密 secret**（2026-07-21，#13）：`supabase functions deploy manage-ai-connections` 之外，运行前必须 `supabase secrets set AI_CREDENTIAL_ENCRYPTION_KEYS=...`（base64 的 32 字节主密钥 JSON，缺失则 create/test 无法加解密），可选 `AI_CREDENTIAL_ACTIVE_VERSION` / `AI_CUSTOM_ENDPOINT_ALLOWLIST`（allowlist 留空则拒绝所有自定义 openai-compatible 端点）。换项目 / 新部署者两步都要重做，切勿提交任何密钥。轮换与 env 细节见函数 README。
- **Generation active pair 由数据库兜底**（2026-07-22，#13）：普通客户端只读 `user_settings`；写入经 `manage-ai-connections`，数据库 trigger 再强制 connection/model 同空同非空、connection 有效且 model 精确等于最近成功测试。连接失效、禁用或成功 model 变化时自动清除旧 active pair。端点/credential 变化必须清 capability；禁用状态下探活不得隐式启用。
- **`rotate-ai-connections` 是独立带外轮换函数**（2026-07-21，#13，US22）：与 `manage-ai-connections` 分离部署，用户请求不可达。部署走 `supabase functions deploy rotate-ai-connections --no-verify-jwt`（不经用户 JWT，仅由自有 secret 守卫），并须 `supabase secrets set AI_CREDENTIAL_ROTATION_SECRET=...`（经 `x-rotation-secret` header 触发，常量时间比较）。轮换把非 active 版本密文重加密到 active 版本；**退役旧密钥版本前必须先跑到「无残留旧版本行」**。curl 示例与流程见函数 README。
- **functions 已纳入根测试门禁**（2026-07-22）：`supabase/package.json` 的 `@asterism/supabase-functions` workspace 负责 typecheck/test；`pnpm test` 当前执行 10 files / 75 tests，无需再额外手工补跑。
- **AI 草稿确认需同时部署两个函数（2026-07-23，#17）**：`manage-ai-organization` 负责受信事务确认，Web 随后调用既有 `bulk-organize` 有界 executor；新环境必须应用 `20260723120000`、`20260723160000`、`20260723190000`、`20260723193000` 并部署这两个函数。Deno Edge Function 的本地相对导入必须显式写 `.ts`，否则 CLI bundling 会失败。当前项目 `hqtrmulypxwdqvzlkhke` 已部署并完成真实事务、幂等、RLS、名称复用 / 拒绝和执行恢复 smoke。
- **#25 可恢复 Generation 已真实验收（2026-08-04）**：迁移 `20260730090000_organization_generation_runs.sql` 在关联项目 `hqtrmulypxwdqvzlkhke` 中已确认 Local=Remote，`manage-organization-tasks` 当前为 `ACTIVE v12`。真实 Chrome 会话以 active DeepSeek Connection 核验 134 个候选的多页任务恢复为 `plan_ready`，Plan revision 1 含 242 actions / 1 conflict / 0 uncertainties，刷新不丢失；另以 442 个候选 / 9 页任务验证暂停、在途调用计账、刷新恢复和 resume 后领取下一 checkpoint，并重新暂停以阻止后续调用。客户端驱动分页 loop 不能用 `active`/`cancel` 标志（会被 `runPending` 的 cleanup 清空导致 outcome 丢失、busy-spin），必须用 `useRef` 防重入 + 直接观测 outcome + `runPending` 翻转重新武装。详见 `logs/2026-08-04-issue-25-real-environment-acceptance.md`。
- **#21 星图 prototype 历史结论（2026-07-24，已于 2026-07-27 随 ADR 0028 删除）**：原型曾证明确定性 PCA 与 Canvas2D 分层渲染技术可行，但技术可行不等于产品必要。正式能力移除后，dev 原型与无调用方的投影模块一并删除；历史实验数据保留在 `logs/2026-07-24-issue21-star-map-prototype-spike.md`。
- **Related Stars 的可用性边界（2026-07-27）**：opt-in 只代表用户许可，不代表向量已可读。每次首次检查 / 增量回填都进入共享 `preparing`；成功失效 `embeddingKeys.list(userId)` 后才进入 `available`，失败进入 `degraded`，二者之外 Related Stars 必须静默。准备轮次用 token 仲裁，旧任务不得解锁较新的轮次。
