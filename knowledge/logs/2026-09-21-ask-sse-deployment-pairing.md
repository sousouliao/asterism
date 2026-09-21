# 2026-09-21 · Ask SSE 生成链路远端部署与配对修复

## 背景

维护者反馈生产提问显示「回答生成失败，请检查网络后重试」。排查确认两端部署错位：

- 生产前端停在 `eb68a4d`（旧 JSON 生成客户端），本地 `0b02b7e`（SSE 客户端）未推送；
- 线上 `ask-generate` 是一次仓库外的工作副本部署（维护者昨晚的试验残留）：生成动作按
  NDJSON 行式 `{"type":"delta","text":…}` 输出，该格式在任何已提交版本中都不存在。
  旧前端对它的 `text/event-stream` 响应做 JSON 解析失败，一律折叠为 `retryable_error`，
  于是「接口明明返回了，界面却报网络错误」。

## 做了什么

- 真实浏览器（已登录生产）复现确认：旧配对下无效 key、未配置 key 的行为与归因；并在
  DevTools 证据下定位到函数版本错位，而非前端解析缺陷。
- 重跑四道门禁（lint / typecheck / test / build）全绿后：
  - `supabase functions deploy ask-generate`：以仓库 `0b02b7e` 的 ADR 0044 SSE 版本
    覆盖试验残留（上传清单恰为 `index.ts` / `handler.ts` / `ask-sse.ts` / `ask-providers.ts` 四个文件）。
  - `git push origin main`（`eb68a4d..0b02b7e`），Vercel git 集成自动部署新前端；
    已验证生产 bundle 含新客户端标记。远端地址更新为仓库迁移后的 `sousouliao/asterism`。
- 新配对冒烟（生产 + 无效 key）：召回 → 生成调用 → `invalid_provider_key` → 正确呈现
  「Provider 拒绝了这个 API key」+ 打开设置；测试用假连接数据已从浏览器清理。

## 结论

前后端已配对为同一协议（Asterism SSE：`event: delta/error/done` + `data: {"text":…}`）。
带真实 key 的流式冒烟（正文逐段出现、停止生成、追问 / 重试、引用卡片、未找到）仍需维护者
用自己浏览器的已验证连接执行，通过后即可关闭 #41。

## 教训

- Edge Function 是「部署面」而非「代码面」：`git` 干净不代表远端与仓库一致。任何
  「接口有响应但客户端报错」的生产问题，先核对两端部署版本的协议配对，再查解析逻辑。
- 试验性部署（哪怕几分钟）也应来自可复现的 commit；手改工作副本部署会让生产态不可追溯。
