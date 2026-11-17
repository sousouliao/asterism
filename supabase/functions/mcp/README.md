# Edge Function · `mcp`

只读远程 MCP Server（Streamable HTTP + OAuth 2.1 Protected Resource Metadata，见 ADR 0050）。

## 只读工具

- `get_library_summary`：收藏库统计、热门语言 / Topic 与集合摘要。
- `search_stars`：按关键词（匹配仓库元数据与个人 `whySaved` / `note`）、语言、Topic、集合与历史状态检索。
- `get_repo`：读取单个库内仓库的元数据、收藏时间、个人 Memory 与所属集合。
- `list_collections`：列出用户所有集合与仓库计数。
- `get_collection`：分页读取集合内的仓库与 Memory。
- `get_related_repos`：优先使用 `user_repo_embeddings` 返回相关仓库，无向量时按 `topics` / 语言 / 集合重合度回退。
- `read_repo_readme`：先校验 `user_stars` 成员关系，再向 GitHub 拉取原始 Markdown（安全截断，不入库）。

## 鉴权与部署

1. 在 Supabase Dashboard **Authentication → OAuth Server** 启用 OAuth Server（建议开启 Dynamic Client Registration），将 **Authorization Path** 设为 `/oauth/consent`。
2. 确保已应用 `20261117120000_mcp_read_rpcs.sql`。
3. 部署函数（`supabase/config.toml` 已声明 `verify_jwt = false`，也可显式加 `--no-verify-jwt`）：

```sh
supabase functions deploy mcp --no-verify-jwt
```

可选环境变量：

- `MCP_PUBLIC_URL`：自定义域名下覆盖保护资源元数据中的 `resource` URL。
- `MCP_AUTH_ISSUER`：覆盖 `authorization_servers`（默认 `${SUPABASE_URL}/auth/v1`）。
- `MCP_ALLOWED_ORIGINS`：逗号分隔允许跨源来源（留空为 `*`）。
