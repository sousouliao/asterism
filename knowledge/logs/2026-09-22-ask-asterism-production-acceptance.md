# 2026-09-22 · Ask Asterism 生产环境验收与 #41 关闭

## 背景

GitHub #41（Ask Asterism 私有问答切片）及 ADR 0042 / 0043 / 0044 / 0045 / 0046 全部演进与视觉交互升级已完成。经本地门禁与部署核验后，在此完成最终真实环境验收并关闭 issue。

## 部署确认

1. **Edge Function**：
   - 无状态 BYOK 代理 `ask-generate` 已成功通过 Supabase CLI 部署至远端项目 `hqtrmulypxwdqvzlkhke`；
   - 包含完整的 `tool` 角色放行、单消息 250,000 / 累计 600,000 字符限制、`tools` 透传、SSE `tool_call` 转换与 OpenAI `/models` 智能对话模型过滤。
2. **Web 生产部署**：
   - Vercel production（main @ `028d527`）构建状态为 Ready（`https://asterism-xcm1115s-projects.vercel.app`）；
   - 包含全部最新交付：一体化上凸流光拉手（Integrated Liquid Tab）、双侧气泡流体毛玻璃质感（Liquid Glass）、Ask 对话舱右侧内容区居中与分层响应式宽度体系、输入框内模型实时切换芯片，以及下拉菜单/浮层触发器的展开激活态统一。

## 真实环境验收结果

1. **未配置 Key 引导**：
   - 首次访问或未配置 Key 时，底部 Ask 对话舱明确呈现「Ask needs a provider key」卡片与前往设置引导，符合隐私与防幻觉契约。
2. **连接配置与内联探针门禁**：
   - 设置页 Ask 分区支持添加 OpenAI 与 DeepSeek 核心连接；
   - 弹窗内置「测试连接」前置门禁：输入测试凭据触发真实探针调用，非法 key 即时被上游拒绝并给出双语警告（「The provider rejected the credential」），未通过测试时「保存」按钮严格保持禁用，杜绝无效 key 入库。
3. **对话舱与拉手交互**：
   - 一体化上凸流光拉手渲染优雅，点击空白处（Click Outside）或按 Esc 可平滑收起对话，已收起状态再次按 Esc 彻底清空；
   - 聚焦输入框或提交问题自动展开，无突兀弹窗感。
4. **防幻觉与隐私边界**：
   - 目录常驻 Agent 仅在客户端进行本地工具取证，read gate 严格约束推荐 repoId 必须属于已 expand 的集合；
   - API Key 仅存浏览器本地 localStorage（按用户隔离、版本化键），服务端零存储。

## 工程门禁

- **自动化测试**：全库 53 个测试套件、282 项单元测试全绿通过；
- **类型检查**：8 个包 `pnpm typecheck` 全部通过；
- **代码规范**：`pnpm lint` Biome 0 错误 0 警告；
- **生产打包**：`pnpm build` 全包构建成功。

## 结果

- GitHub Issue #41 附完整验收总结评论后关闭；
- 同步更新 `PROGRESS.md` 与 `BACKLOG.md`，将 Ask Asterism 标记为已完成；
- 下一恢复点切换至 Star 完整同步与历史远端验收（ADR 0047）。
