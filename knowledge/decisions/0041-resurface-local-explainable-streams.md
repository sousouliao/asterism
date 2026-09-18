# ADR 0041 · Resurface 沉睡唤醒：本地可解释双流与本地反馈

- Status: Accepted
- Date: 2026-09-19
- Implements: GitHub #40 `feat(memory): resurface inactive stars and contextual memory streams`
- Preserves: ADR 0037 Memory 模型、ADR 0039 的「解释只陈述可验证事实」原则、ui-ux 契约 Graphite Glass 与「不做遥测」

## Context

主页（Dashboard）只展示静态语言占比与 Topic 统计，收藏即遗忘：大量 Star 长期沉睡，
用户无法在合适时机重新回想起曾关注的项目。GitHub #40 授权交付 Resurface & Memory Streams
纵向切片，明确要求算法**纯本地、可解释**，严禁黑盒推荐，并提供 Useful / Dismiss 显式反馈。

关键约束：

- 产品没有任何「访问 / 回访」行为数据（也无遥测），任何「你长期未访问」式表述都不可验证。
- 反馈属于用户意图，不应写入 canonical，也不应变成跨用户或服务端信号。
- 上一里程碑（#39 复核）刚清退过不可证实的归因，唤醒理由必须延续同一纪律。

## Decision

- **算法落在 `@asterism/core`（`repos/resurface.ts`）**：`deriveResurfaceStreams` 是纯函数，
  输入 starred records、`memoriesByRepoId`、压制集与 `now`，输出双流候选。维度全部可解释：
  - 沉睡档位（180d / 1y / 2y / 3y 阶梯分）；
  - 整年纪念日（±3 天日历窗口，`setFullYear` 日历对齐，容忍时区与同步误差）；
  - Memory 信号（有 note、有 whySaved 加分，whySaved 只作为分数不作为展示理由）；
  - 仓库静默（pushed ≥ 2 年）；
  - 客观价值（stargazers 档位，仅用于待补全排序与 ≥1000 的 `high_value` 理由）。
  排序完全确定：score → stargazers → fullName（码点序）→ repoId。
- **双流与优先级**：
  - **Worth remembering**（值得重温）：沉睡 ≥ 180 天且具备个人信号（纪念日 / note / whySaved），
    上限 3 条；
  - **Missing context**（待补全记忆）：收藏 ≥ 30 天且未记录 `why_saved`，上限 2 条；
    同一仓库同时满足两流时只进 Worth remembering。
  合计 ≤ 5 条，对齐 issue 的「3~5 张卡片」。
- **理由只陈述可验证事实**：anniversary / dormant / noted / repo_quiet /
  missing_why_saved / noted_without_reason / high_value 七种结构化理由，各自携带原始数值
  （年数、天数、star 数）由 UI 层本地格式化；不产出「未访问」「可能喜欢」类推断。
- **反馈是纯客户端状态**：`apps/web/src/lib/resurface-feedback.ts` 以
  `asterism:resurface-feedback:v1:{userId}` 版本化键存 localStorage，try/catch 降级会话内；
  Useful 与 Dismissed 都使该仓库进入 **90 天压制期**（情感分别记录，供未来算法迭代），
  压制按仓库（跨流）生效；写入时顺带清理过期条目。无遥测、不写 canonical。
- **Dashboard 集成**：Resurface 分区置于统计卡之上；memories 查询未完成时显示镜像骨架，
  查询失败或无候选时整段不出现（遵循「空态判定等待全部首屏查询」）。卡片复用 Browse 的
  整卡 overlay 触发器模式打开 Repo Quick Look（`sourceKey: 'resurface'`，J/K 在候选内移动），
  Missing context 卡额外提供「补写收藏原因」入口；worth 卡回显用户自己的 whySaved / note 原文。
- **dev-only 预览路由**：`/dev/resurface-preview`（`import.meta.env.DEV` 守卫，随
  `/dev/readme-corpus` 同一机制）用固定 fixture 覆盖全部理由分支，供无后端视觉 QA。

## Consequences

- 主页获得主动唤醒能力，且每张卡片都能回答「为什么现在提醒我」；算法可单测、可复现。
- 无访问数据是永久边界：将来若引入回访信号，必须先有真实数据来源并新开 ADR，
  不得悄悄改写 dormant 理由的表述。
- Useful 与 Dismissed 当前效果相同（90 天压制），差异只在于记录的情感；这避免在无
  学习回路的产品里假装「有用会提升推荐」，诚实于本地边界。
- 反馈键按用户隔离、按仓库粒度压制：用户 Dismissed 一个仓库后，它不会立即从另一流再冒出。
- 预览路由为 dev 专用，fixture 不进生产包；其记忆区在无会话时显示未记录态属预期。
- 纪念日依赖 `user_stars.starred_at` 的准确性（GitHub 提供）；同步误差由 ±3 天窗口吸收。
