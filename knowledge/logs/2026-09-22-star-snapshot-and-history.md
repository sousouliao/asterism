# 2026-09-22 · Star 完整同步与可找回历史

用户希望 Star 更新无须每次手动重新连接，同时取消 Star 的仓库仍能作为个人记忆找回。按 ADR 0047 落地：`sync-stars` 完整拉取当前 GitHub Star 列表，分页全部成功后调用单个数据库事务对账；缺席的旧关系记录发现时间 `unstarred_at`，不删除 Memory 或 Collection；再次 Star 清空历史状态并复用原 Memory。

GitHub 凭据由受信 Edge Function 加密保存在专用表，浏览器开站后按新鲜度静默同步，并轮询同步状态以接收后台更新；Supabase Cron 模板负责关站后的定期同步。Browse 增加当前 Star / 历史切换；Collection、Ask、导入导出读取完整资料库，Dashboard 仍只看当前 Star。中英文文案、契约与部署说明同步更新。

本地验证：`pnpm typecheck`、Core 142 项单测加一项游标回退用例、DB 59 项单测、Web 282 项单测、Web 生产构建、变更文件 Biome 检查与 `git diff --check` 通过。当前环境没有本地 PostgreSQL/Docker，新增的 pgTAP 尚未运行；远端 migrations、函数、Secrets、Cron 与 Web 也尚未部署。部署与真实账号验收步骤记录在 `supabase/functions/sync-stars/README.md`，开放项见 `state/BACKLOG.md`。
