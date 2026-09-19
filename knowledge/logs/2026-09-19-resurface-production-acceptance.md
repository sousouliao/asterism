# 2026-09-19 · Resurface 真实环境验收与 #40 关闭

## 背景

GitHub #40 的本地实现、四道工程门禁与 dev 预览路由视觉 QA 已完成（见 `2026-09-19-resurface-memory-streams.md`），剩余完成判据是部署后在真实账号下确认 Dashboard Resurface 分区。

## 部署确认

- main 的 Vercel git 集成已自动构建 production 部署（commit `972b2d2`，READY），包含 #40 全部代码（`5ea1f50`），无需额外触发部署。
- 项目未绑定自定义域名，`*.vercel.app` 受账号 Deployment Protection（SSO）保护；验收浏览器需先完成 Vercel 登录，再在应用内完成 GitHub OAuth（Supabase）登录真实账号。

## 真实账号验收结果（sousouliao，531 stars）

- **双流渲染**：Worth remembering 3 张卡（geektutu/high-performance-go、natee/build-your-own-vue-next、dunwu/db-tutorial）；Missing context 2 张卡（codecrafters-io/build-your-own-x、public-apis/public-apis）。
- **可验证理由**：整年纪念日（「Starred 4 years ago today」）、仓库静默（「No repo updates for 3y / 5y」）、Memory 信号（「Saved 3y ago」）、star 档位（「521K stars」）、未记录原因（「No saved reason yet」）均按算法预期出现。
- **反馈交互**：Dismiss 与 Useful 点击后卡片立即移出流；刷新页面后压制状态保持（`asterism:resurface-feedback:v1:{userId}` 版本化 localStorage，按用户隔离）。
- **记忆补写入口**：「Add why you saved it」打开对应仓库 Quick Look，Memory 区域显示 Why I saved this / Note 未记录状态与 Edit 入口。
- **数据还原**：QA 中写入的两条本地反馈（geektutu useful、dunwu dismissed）验收后从 localStorage 清除，刷新后 5 张卡全部恢复，与初始状态一致。

## 验收中的工程观察

- 本环境 in-app browser 的 Playwright 高层 click 与 screenshot 通道偶发超时（actionability / surface preparation），DOM 快照与 `locator.evaluate(el => el.click())` 页面内派发均正常；功能本身无异常，判定为自动化通道问题而非产品缺陷。
- 应用为 BrowserRouter（路径路由），OAuth 回调残留的 `#` 不参与路由。

## 结果

- GitHub #40 附验收评论后关闭。
- PROGRESS / BACKLOG / roadmap 同步：Resurface 标记 Done 并验收关闭，下一恢复点为 GitHub #41（Ask Asterism 私有问答）。
