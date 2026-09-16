# Clean pre-pivot baseline

Date: 2026-09-17  
GitHub: #38

## Outcome

- 更新 `retire_user_tags.test.sql` 使用当前六参数 `create_bulk_operation`，补齐 pgTAP `finish()`，并用事务回滚隔离 fixture。
- 保留 `trusted_collection_relation_mutations.test.sql` 的显式清理；该文件通过独立 `dblink` 连接验证并发，不能把 fixture 放入外层未提交事务。
- 删除已失效的 `.scratch/retrieval-first/` 草稿、发布脚本和星图图片；正式决策与实验结论仍保留在 ADR / logs。
- 将 README corpus lab 的 lazy import 收进 DEV-only route factory；生产构建不再输出 `readme-corpus-lab` chunk。
- 测试环境会实际探测 `localStorage` 可写性，不再误用 Node 暴露但不可工作的 storage。
- 删除无消费者的 `CORE_VERSION` 与 locale key，并把 Desktop placeholder 输出改为跨 Windows code page 的 ASCII 文案。
- 将 CI 的 `checkout` / `setup-node` / `pnpm/action-setup` 升级到当前官方 major，消除 GitHub runner 的 Node 20 action runtime 弃用注解。

## Verification

- Web 定向测试通过，且不再输出 Zustand persist storage warning。
- Web production build 通过，产物中没有 README corpus lab chunk。
- 本机没有 Docker，pgTAP 由 GitHub Actions 的 Supabase job 做最终验证。
- 全仓四道门禁与 GitHub Actions 结果记录在 issue 关闭评论中。
