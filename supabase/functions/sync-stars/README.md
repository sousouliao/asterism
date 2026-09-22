# Edge Function · `sync-stars`

将 GitHub 当前 Star 列表与 Asterism 资料库完整对账。取消 Star 只改变关系状态，Memory 与 Collection 保留。决策见 ADR 0047。

## 请求与授权

- 用户触发：`POST`，由 `functions.invoke` 携带 Supabase 用户 JWT。请求体可包含 `providerToken` 和 `providerRefreshToken`；首次连接必须提供 access token，之后可复用服务端保存的加密凭据。
- 定时触发：`POST`，网关使用 anon JWT，另需 `X-Asterism-Scheduler` 与 Edge 环境中的 `GITHUB_SYNC_SCHEDULER_SECRET` 一致；请求体为 `{ "userId": "<uuid>" }`。不能用用户自报的 ID 走普通 JWT 分支。
- 响应：`{ total, upserted, starsLinked, unstarred }`。前三项是当前快照中的仓库数；`unstarred` 是本轮新移入历史的数量。

函数验证 GitHub token 对应的账号与 Supabase GitHub identity 相同；过期且有 refresh token 时向 GitHub 轮换。受信表 `github_sync_credentials` 只保存 AES-GCM 密文，普通客户端无表级读写权限。用户可通过 `github_sync_status()` 读取本人连接状态和上次成功同步时间。

## 对账

1. 拉完 GraphQL `viewer.starredRepositories` 所有游标页。任何分页、授权或上游错误都不应用快照。
2. 单次 `apply_github_star_snapshot` RPC 事务更新 `repos`、`user_stars`、基础 `memories`，并将快照缺席的旧 Star 标记 `unstarred_at`。
3. 再次 Star 清空 `unstarred_at`，复用原 Memory；个人笔记与集合关系从不由同步删除。

## 部署

先应用 `20260922120000_github_sync_credentials.sql` 与 `20260922121500_star_history.sql`，再设置 Edge secrets：

| Secret | 用途 |
| --- | --- |
| `GITHUB_SYNC_ENCRYPTION_KEY` | 固定的 32 字节随机密钥，base64 编码；可用 `openssl rand -base64 32` 生成。丢失后已有密文不可恢复。 |
| `GITHUB_SYNC_SCHEDULER_SECRET` | 独立随机调度密钥；可用 `openssl rand -hex 32` 生成。 |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | 仅当 GitHub OAuth App 使用会过期的 token、需要轮换 refresh token 时配置；与 Supabase GitHub provider 使用同一个 OAuth App。 |

`SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY` 由 Supabase 注入。不要把上述密钥写进仓库。随后执行 `supabase functions deploy sync-stars`。旧会话没有服务端凭据的用户需重新连接 GitHub 一次，开站静默同步即可建立连接。

关站后的自动同步由 Supabase Cron 负责：

1. 在 Supabase 启用 `pg_cron`、`pg_net` 和 Vault。
2. 在 Vault 创建 `asterism_project_url`（项目根 URL）、`asterism_anon_jwt`（项目 legacy anon JWT）与 `asterism_scheduler_secret`（和 Edge secret 相同的值）。
3. 在 SQL Editor 执行 [`schedule.sql`](./schedule.sql)。它每六小时调用到期的连接，每轮最多 20 个用户；单用户自部署通常只有一条。若要重建任务，先取消同名 Cron job。

部署后以真实账号检查：首次连接自动同步；刷新页面仍显示同步入口而非重新连接；取消 Star 后定时或手动同步把仓库移入历史且保留 Memory；再次 Star 后返回当前列表；撤销 GitHub 授权后显示重新连接。运行中的定时结果可在 `github_sync_credentials.last_synced_at / last_error` 和 Supabase Cron job 记录中核查。
