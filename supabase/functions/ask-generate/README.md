# ask-generate

Ask Asterism 的无状态生成代理（ADR 0042，GitHub #41）：校验 Supabase 会话后，把客户端组装的 prompt 以单次 JSON 请求转发到用户 BYOK 的 OpenAI 兼容上游。Provider 白名单（DeepSeek / OpenAI / Groq / OpenRouter）映射固定 base URL，不接受白名单之外的自定义端点。用户的 Provider key 仅随本次上游请求透传，不写入日志、Postgres 或任何存储；函数不保存会话状态。上游 401 映射为 `invalid_provider_key`，4xx/429 映射为 `provider_rejected`，网络故障为 `retryable_error`，60 秒无响应为超时。

部署：

```sh
supabase functions deploy ask-generate
```
