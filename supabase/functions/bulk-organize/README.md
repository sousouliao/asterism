`bulk-organize` 是 Issue #11 的受信批量关系写入路径。函数验证 Supabase JWT，随后使用 service role：

- 创建固定 repository ID 范围与逐关系执行账本；
- 以 50 条为上限领取有界批次；collection 经受信 mutation RPC
  原子记录 relation head、effective mutation receipt 与 item identity；
- 记录成功、可重试失败与终止失败，并只重试可重试项；
- 在用户明确接受剩余终止失败后结束操作。

普通客户端对 `bulk_operations` / `bulk_operation_items` 只有本人行的读取权限，不能直接写入状态或关系。函数不会调用 GitHub API，也不会执行 star/unstar。

`bulk-organize` create 请求只接受 `manual`，并要求 `interaction = bulk_dialog` 与 UUID
`clientRequestId`。相同用户重复提交同一个 `clientRequestId` 会恢复同一 operation。历史
`promotion` 账本可继续读取，但产品不再创建 AI 来源的 operation。Collection Dial 的
`collection_dial` / Undo 路径已由 ADR 0036 退役。

```bash
supabase functions deploy bulk-organize
```

运行时只使用 Supabase 自动注入的 `SUPABASE_URL` 与 `SUPABASE_SERVICE_ROLE_KEY`，不得把 service-role key 放入 Web 环境变量。
