# PROGRESS · 项目进度与恢复点

> 这里只记录当前状态、已完成里程碑和下一恢复点。详细执行历史见 `knowledge/logs/`，决策理由见 `knowledge/decisions/`，开放项见 `BACKLOG.md`。

## 当前状态

- **产品定位**：Personal Open Source Memory（ADR 0037）。Asterism 是开源、可自部署的个人开源软件记忆库，GitHub Stars 是首个来源。
- **当前状态**：GitHub #39 `feat(retrieval): Unified Retrieval with Memory & Match Explanation` 已完成复核与修正。统一检索引擎将用户私有记忆（whySaved, note）融入词法排序与本地语义向量，输出可验证的 Match Explanation；Related Stars 通过合并向量表达个人意图，并在向量不可用时按 Topic / Memory 关键词可信降级。
- **当前工程 frontier**：推进下一代检索与唤醒功能。三个纵向切片中的 #39 已完成；下一活动执行目标为 #40（沉睡唤醒 Resurface）。
- **本轮边界**：保持个人库私有优先；检索与问答不接入外网，不凭空生成虚假推荐。
- **延后方向**：Extension / Desktop 等待核心检索与交互稳定后再启动。AI 自动联网搜索、Snapshot 追踪、Research Session、MCP 暂未进入开发。

## 已完成里程碑

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

1. 推进 GitHub #40（Resurface 唤醒流）：基于统一检索与意图权重的沉睡 Star 智能唤醒与推荐。
2. #40 验收完成后，推进 #41（Ask Asterism 私有问答）。

## 环境提示

- 本机当前没有可用 Docker，因此 `pnpm test:db` 需由 GitHub Actions 的本地 Supabase job 验证。
- 维护者 Supabase project ref 为 `hqtrmulypxwdqvzlkhke`；任何远端 migration / function 变更都需按 runbook 显式部署与 smoke，不因本地代码提交自动生效。
