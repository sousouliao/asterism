# ADR 0047 · 完整 Star 对账与可找回的历史

- Status: Accepted
- Date: 2026-09-22
- Supersedes: ADR 0006 中「只在会话内使用 provider token、按最新 Star 时间增量截断」的限制

## Context

原 `sync-stars` 在首条不晚于本地最新 `starred_at` 的记录处停止，无法发现取消 Star，也不会刷新旧仓库元数据。Supabase 登录态可继续存在，但 GitHub `provider_token` 不由 Supabase 持久化或刷新，导致用户反复点击重新连接。Asterism 的产品定位已把 Star 设为 Memory 的来源，而非 Memory 的生命周期。

## Decision

1. 每次同步完整分页读取当前用户的 GitHub Star 快照。所有分页成功后，以单个受信数据库事务 upsert 仓库元数据、当前 Star 和缺失基础 Memory，再把快照缺席的旧 Star 标记 `unstarred_at`。请求或事务失败时不应用部分 Star 状态。
2. `user_stars` 是用户曾 Star 过的关系，`unstarred_at is null` 才表示当前仍 Star。取消后保留 Memory、Collection 和历史可检索性；再次 Star 清空历史状态并更新 `starred_at`，复用原 Memory。`unstarred_at` 是发现时间，不是 GitHub 操作时间。
3. 当前 Star 是 Browse 默认范围，历史是独立范围；Collection、导入导出与 Ask 可读取历史，Ask 必须区分当前与历史。Dashboard 仍统计当前 Star。
4. 首次有效同步时，受信 Edge Function 用部署者配置的 AES-GCM 密钥加密存储每用户 GitHub access token 与可用的 refresh token。浏览器不持久化第三方凭据。开站时超过六小时静默同步一次，并轮询同步状态以接收后台结果；Supabase Cron 每六小时调度到期连接，使关站后仍同步。失效凭据在服务端标记待重新连接。

## Trade-offs

- 完整对账每次需要遍历所有 Star，成本高于旧增量，但取消 Star 无法由旧时间界发现；个人资料库量级先采用单一路径，避免快慢两套同步语义。
- 服务端加密凭据扩大了托管责任；表对普通客户端不可读，密钥仅在 Edge Function 环境中配置，定时调用另需独立密钥。部署者必须管理密钥与调度。密钥丢失时需重新连接 GitHub；不承诺无痛轮换。
- GitHub access token 已撤销、refresh token 失效或授权取消时仍需要一次人工重新连接。后台轮询是最终一致，不承诺 GitHub 操作后即时更新。
- 目前不迁移到 GitHub App，也不使用按仓库的 Star webhook：现有 GitHub OAuth 可支持当前只读来源，完整快照能直接表达用户当前集合。
