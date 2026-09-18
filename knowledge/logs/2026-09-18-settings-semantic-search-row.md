# Settings semantic search row

## Context

设置页「语义搜索」行在已就绪状态下把三种不同性质的东西并排成一个按钮组：状态 chip `已就绪`（Badge / 22px / 12px 字号）、常规维护 `重建索引`（outline / 32px）、销毁索引 `清理模型`（ghost / 32px 且无边框、无图标）。

实测三者几何与层级都不同源：22 / 32 / 32 的高度、12px 与 14px 字号、填充 chip 与描边按钮与纯文本三种表面。结果是状态被当成按钮看待、`清理模型` 在视觉上退化成散落文本，而破坏性动作反而是整行最轻的元素。此外：

- 排序位置与动作层级之外，重建索引只把两个按钮置灰，没有说明哪个动作在跑；`重试` 甚至没有任何 pending 保护。
- 未同步任何仓库时只留下一个不可用的禁用按钮，没有说明原因。

## Changes

- 设置行改为固定的两段式：左段承载标题 + 状态徽标 + 描述，右段只承载可执行动作；`SettingRow` 新增 `badge`，右段容器统一 `justify-end` + `sm:ml-auto`，行内控件在换行后仍贴右边缘。
- 状态不再进入动作区：`正在准备 N%`（带 spinner、`role=status`）与 `已就绪` 用次级 Badge，`需要处理` 用破坏性描边 Badge + 警告图标。
- 维护动作统一为同一套按钮几何（default 尺寸 / `rounded-md` / 8px 间距）：`重建索引`（或 `重试`）用 outline，`清理模型` 沿用「退出登录」的 `border-destructive/40 text-destructive` 次级破坏性描边，并抽出 `DESTRUCTIVE_OUTLINE_CLASS` 供两处共用。
- 写操作补齐原位反馈：`重建索引` / `重试` 使用既有 `PendingActionContent` 做按钮内 spinner + 动作文案并保持宽度稳定，`aria-busy` 标记运行中的动作，同组动作停用；`清理模型` 的确认对话框在 pending 期间禁用关闭按钮，并补上此前硬编码英文的 `closeLabel`。
- 未同步仓库时改为主栏内说明「先同步 Star 仓库，再启用语义搜索。」，不再只给一个禁用按钮。
- 新增 `apps/web/src/pages/settings.test.tsx`，覆盖就绪 / 准备中 / 需要处理 / 写操作中 / 无仓库五个状态与「状态不落在动作区」的结构约束。

## Verification

- 真实 dev server 逐状态截图（就绪 / 准备中 / 需要处理 / 重建中 / 无仓库 / 未启用）：状态徽标均与标题同行，动作区只有按钮；维护按钮实测同为 36px 高、6px 圆角、16px 内边距、8px 间距，`清理模型` 为 destructive 色。
- 断点检查 1440 / 1024 / 768 / 390：英文长描述在 `sm` 以上与动作区同排并自动换行，动作区在 ≥sm 右对齐、`<640px` 随文本左对齐；无横向溢出。
- Light / Dark × en / zh-CN 全页视觉检查，账号行「退出登录」与本行 `清理模型` 共用同一破坏性描边；确认对话框（含 Escape 关闭）行为正常。
- Impeccable detector、`pnpm lint`、`pnpm typecheck`、`pnpm test`（web 205 / db 41 / functions 31）、`pnpm build` 通过。

## Follow-up（同日复核）

复核提出三点：描述文案要改、设置页控件高度仍未统一、`重建索引` 左右留白过多且需排查全项目同类问题。

### 文案

`settings.semanticSearchDescription` 去掉 `受 RLS 保护` 这类实现术语，改为「只有派生向量会写入你自己的私有数据库」；en 同步为 `only the derived vectors are stored in your private database`。

### 控件高度：尝试统一后回退

设置页同时存在 45.5px（主题 rail）/ 36px（语言 Select、按钮）两种高度，曾尝试把 `SegmentedControl` 的 tab 从 `py-2 leading-normal` 改为固定 `h-6.5`（26px）+ `leading-4`，使 rail 总高收敛到 36px（26 + 4×2 + 1×2）。视觉复核否决：26px tab 只剩约 5px 垂直留白，13px 文字被挤在蓝色 indicator 里，矮而局促，比原来的轨道更丑。已把 `segmented-control.tsx` 完全回退到 8px/14px tab padding 的原状，并放弃「rail 与表单控件等高」这个目标。

保留的结论：GlassRail 是自带轨道高度的独立控件类，不参与表单控件的高度对齐；设置行要统一的是 Select 与 Button（两者现均为 36px）。触控设备的 44px 命中区域仍由 `globals.css` 的 `@media (pointer: coarse)` 最小尺寸规则统一提供。该决定已写入 `ui-ux.md` 的 Glass Control Pattern，避免后续再收敛一次。

### 按钮宽度与全项目排查

`重建索引` 偏宽不是写死宽度，而是 `PendingActionContent` 用同一格叠放 idle / pending 文案以稳定宽度：格子宽度取两者较大值，而 `重建索引中…` 加 spinner 后比 `重建索引` 宽 32.6px，这段差额被永久计入按钮。

修法是不动组件契约（宽度稳定对 `重新连接 GitHub → 连接中…` 这类「pending 明显更短」的按钮仍然必要），而是把 pending 文案收短到 idle 文案之内：

| 使用点 | idle 文案 | pending 文案 | 保留宽度差（修前 → 修后） |
| --- | --- | --- | --- |
| 设置 · 重建索引 | 重建索引 | 正在重建… → **重建中** | 88.6 / 56（+32.6）→ 66 / 56（+10） |
| 设置 · 重试 | 重试 | 正在重试… → **重试中** | — → 66 / 28 |
| 确认对话框 | 清理模型 | 删除中… → **删除中** | 70.8 / 56（+17.6）→ 66 / 56（+10） |
| 集合表单提交 | 新建集合 | 保存中… → **保存中** | 约 +24 → 62.7 / 53.2（+9.5） |
| Quick Look 保存 | 保存记忆 / 保存更改 | 保存中… → **保存中** | 约 +20 → 约 +6（按同式推导，未逐项实测） |
| README 重新连接 | 重新连接 GitHub | 连接中… | idle 更宽，本无多余留白 |

实际效果：`重建索引` 122.6 → 100px（邻居 `清理模型` 90px），且待命态与待命结束后宽度完全一致（100 → 100），不再有跳变。全项目按钮宽度复查：只有图标按钮使用固定 `size-*`、触摸目标使用 `min-w-11`、对话框与登录使用 `w-full`，没有任何按钮写死内容宽度。规则写入 `ui-ux.md` 的 Loading Feedback Pattern 与 Glass Control Pattern。
