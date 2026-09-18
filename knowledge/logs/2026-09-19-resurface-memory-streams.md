# 2026-09-19 · Resurface & Memory Streams 交付（GitHub #40）

## 目标

交付 GitHub #40 `feat(memory): resurface inactive stars and contextual memory streams`：
主页沉睡唤醒双流（值得重温 / 待补全记忆）、纯本地可解释算法、Useful / Dismiss 本地反馈、
Quick Look 快捷编辑与补写入口，双语 + 桌面 / 移动 + a11y，全仓四道门禁通过。

## 执行内容

1. **算法（`packages/core/src/repos/resurface.ts` + 测试）**
   - `deriveResurfaceStreams` 纯函数：沉睡档位、整年纪念日 ±3d、note / whySaved 信号、
     仓库静默 ≥2y、stargazers 档位；确定排序（score → stars → fullName → repoId）。
   - 双流优先级：worth_remembering（沉睡 ≥180d + 个人信号，上限 3）压制
     missing_context（≥30d 无 whySaved，上限 2）；七种结构化理由只陈述可验证事实。
   - 20 个单元测试覆盖资格边界、纪念日窗口（含未来 3 天内）、档位、理由排序、
     双流互斥、上限与平局确定性。
2. **本地反馈（`apps/web/src/lib/resurface-feedback.ts` + 测试）**
   - `asterism:resurface-feedback:v1:{userId}` 版本化键；shape 校验、损坏降级、
     写入清理过期；90 天压制；`useSyncExternalStore` 提供稳定快照（显式 `now` 实时计算）。
   - 6 个测试：空态、按用户隔离、窗口边界（严格 `>`）、覆盖写、损坏存储。
3. **UI（`apps/web/src/components/resurface/`）**
   - `ResurfaceCard`：复用 Browse 整卡 overlay 触发器 + 并列 GitHub 外链、理由行
     （icon + caption）、记忆回显（whySaved / note 原文，truncate + title）、
     footer 动作（补写收藏原因 / Useful / Dismiss tooltip+aria）；选中态 inset ring。
   - `ResurfaceSection`：分区标题 + 双流组标签 + `md:2 / xl:3` 网格；挂载时固定 `now`；
     inspector context `sourceKey: 'resurface'`；无候选整段不渲染。
   - `ResurfaceSectionSkeleton`：镜像分区结构（memories 加载期）。
   - Dashboard 集成：memories 加载骨架 / 失败隐藏 / 就绪渲染。
   - i18n：`dashboard.resurface.*` en + zh-CN，`anniversary` 用 `count` 复数；复用
     `browse.openDetails / starred / starredCompact / archived` 等既有键。
4. **dev 预览路由**：`/dev/resurface-preview`（DEV 守卫）fixture 覆盖全部理由分支。

## 视觉 QA（dev 预览 + 无头浏览器）

- 桌面 1440 浅色 en：三列网格对齐、层级清晰、截断正常（fullPage 截图的「重复 / 裁切」
  为截图伪影，视口截图复核通过）。
- 暗色 zh-CN：表面层次、边框、混排空格、caption 对比度通过。
- 移动 390×844：单列堆叠、左右留白、按钮可点、无横向溢出。
- 交互：整卡点击打开 Quick Look（480px 右下 24px、选中 ring 正确）；Dismiss 移除卡片并落盘
  （`resurface-preview` 键验证）；Esc 处理器确认触发（IAB 后台窗格节流导致关闭动画不推进，
  属预览环境伪影，前台浏览器与既有组件测试不受影响）。

## 验证门

- `pnpm lint`（295 文件）· `pnpm typecheck` · `pnpm test`（7 任务，web 213 / core 20+ 新增）·
  `pnpm build` 全部通过；仅存在既有 Vite chunk 500KB warning（按契约不阻断）。

## 决策与知识同步

- ADR 0041 记录算法纪律（可验证理由、无访问推断）、反馈语义（90 天压制、情感分记）、
  dev 预览路由边界。
- Roadmap / product 契约 / PROGRESS / BACKLOG / NOTES 已同步；#40 待远端部署后关闭。

## 遗留

- 真实账号下的端到端视觉确认待部署 preview 后进行（本地已用 dev 预览路由覆盖）。
- Useful 的正向情感暂无消费方；引入任何学习回路需新 ADR。

## 追加 · 页面滚动条贴边修复（用户反馈）

预览页截图反馈「滚动条应该贴边」。根因：五个整页滚动页面（Dashboard、Collections、
Collection Detail、Import / Export、Settings）把 `max-w-6xl` 直接放在滚动容器上并嵌在
`AppLayout` 的 `p-6` 主区内，窄屏下轨道距窗口右缘 24px、宽屏最多 168px，违反 Browse 已
确立的「全宽滚动层 + 内层限宽」模式。修复：全部改为 `-m-6` 全宽滚动层 + 内层
`px-6` + `mx-auto max-w-6xl`；预览页改为 `h-svh` 列 + 自有全宽滚动层；ui-ux 契约
Scrollbar 节同步显式禁止把 `max-w-*` / 页面 padding 放在滚动容器上。500px 视口实测
轨道贴边，四道门禁复跑通过。
