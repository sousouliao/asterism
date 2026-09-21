# 2026-09-21 · GitHub CI 自 Memory Foundation 起持续失败

## 现象

`main` 上 CI 从 `feat(memory): add Why I saved this and clean memory model`（2026-09-17）起连续失败。lint / typecheck / 单测都过；挂在 `pnpm test:db` 的 `memory_foundation.test.sql`。

最新失败：https://github.com/sousouliao/asterism/actions/runs/35578773366

```
ERROR:  permission denied for table memories
HINT:  Grant the required privileges to the current role with: GRANT SELECT ON public.memories TO authenticated;
Parse errors: Bad plan.  You planned 8 tests but ran 4.
```

前 4 条断言在默认超级用户下通过；第 5 条起 `set role authenticated` 后读表被拒。`memory_repair` 只在 authenticated 下调已 GRANT EXECUTE 的 RPC，所以一直绿。

## 原因

`20260917120000_memory_foundation.sql` 建了 `memories`、开了 RLS、写了 `memories_owner_all`，但没有表级 GRANT。RLS 管「能看见哪些行」，不管「有没有权碰这张表」。托管 Supabase 常靠默认特权掩盖；CI 用的本地镜像不会自动授权。`user_repo_embeddings` 是同一类缺口，只是还没有 authenticated 直查的 pgTAP。

## 处理

新增 `20260921120000_grant_client_memory_tables.sql`，对两张客户端直读写表授予 `select, insert, update, delete` 给 `authenticated`。契约 `data-model.md` / `conventions.md` 写明：RLS 不能代替 GRANT。

本机无 Docker，`pnpm test:db` 仍靠 GitHub Actions。远端 `hqtrmulypxwdqvzlkhke` 尚未 `db push`——托管项目若已有默认特权，这条 GRANT 幂等；若没有，Quick Look / embedding 直写也会被同一错误挡住。
