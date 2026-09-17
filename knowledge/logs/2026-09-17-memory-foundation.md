# Memory Foundation · 本地与远端部署

Date: 2026-09-17  
GitHub: #37  
Status: Implementation and remote deployment complete

## Outcome

- 新增每个 `(user_id, repo_id)` 唯一的 `memories` 模型，承载 GitHub Star 来源、`why_saved` 与自由笔记。
- 按 ADR 0038 直接删除旧 `notes` 模型；没有数据迁移、双写、兼容 API 或 v1/v2 JSON 导入。
- `sync-stars` 在增量同步前后运行幂等 repair，为既有 Star 补齐基础 Memory，冲突时绝不覆盖用户内容。
- Repo Quick Look 将 Memory 放在 Overview 之后，支持双字段加载、编辑、清空、保存、离开保护与写失败恢复；空原因明确显示“未记录”，不做 AI 推断。
- JSON 导入导出升级为 v3 Memory 格式；CSV / Markdown 保持只导出语义，Markdown 展示个人 Memory。
- 同步更新 core、db、web hooks、bulk export、i18n、自动化测试、pgTAP、Contracts、Roadmap 与 runbook。
- 远端 Supabase 恢复后，成功应用 `20260917120000_memory_foundation.sql` migration 并部署更新后的 `sync-stars` Edge Function。

## Verification

- `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build` 全部通过。
- 桌面 2304 × 928 实测空状态、编辑态与保存态；手机 390 × 844 实测保存态，信息层级、操作可达性与响应式布局符合现有 Graphite Glass 界面。
- 独立 finish review 首轮指出手机 Sheet 固定高度、关闭语义与无改动编辑退出问题；同轮修正为内容自适应最大高度、明确 Close、移动触控命中区与始终可用的 Cancel，并补回归测试。复核结论为 `SHIP`。
- 使用本机回环假 Supabase 验证实际 PostgREST 读取、PATCH 保存、Query cache 更新及 Note 标记；没有为 QA 修改生产代码。
- 本机没有 Docker，未运行本地 pgTAP。
- 远端 Supabase（project ref: `hqtrmulypxwdqvzlkhke`）restore 后重新建立 CLI link，通过 `supabase db push` 成功应用 `20260917120000_memory_foundation.sql`，旧 `notes` 表与策略已清理，新 `memories` 表与 RLS 策略已就绪。
- 通过 `supabase functions deploy sync-stars` 成功部署包含 memory repair pass 的 Edge Function。

