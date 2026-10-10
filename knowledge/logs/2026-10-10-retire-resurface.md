# 重温收藏退役

- 授权：用户在价值讨论后明确要求「去掉吧，也保持代码整洁干净」。
- 决策：ADR 0049 取代 ADR 0041。洞察页直接显示原有统计与图表，按需检回由搜索、Ask 与 Related Stars 承接。
- 清理：删除 10 个专用文件（推荐算法与测试、卡片 / 理由 / 分区 / 骨架 / 组件测试、反馈存储与测试、开发预览页），移除 core 导出、预览路由、中英文翻译及洞察页专用状态与 Memory 映射。同步修订 Memory repair 的过时注释，未改同步行为或历史 migration。
- 保留：个人记忆数量统计、Quick Look 收藏原因与笔记、Collection、搜索、Ask、Related Stars 与同步。旧本地反馈键停止读写，不引入清理迁移。
- 知识同步：产品 / UI 契约、Web 产品摘要、路线图、PROGRESS / NOTES / BACKLOG 与 ADR 状态。历史日志和长期提案保留，不作为恢复授权。
- 验证通过：修改代码的局部 Biome（5 文件）、core / Web 类型检查、core / Web 构建、洞察统计测试（2 项）、locale 测试（4 项）、Memory 区域测试（2 项）、`git diff --check`；运行时源码搜索无 Resurface 残留引用。Web 构建仍有原有 chunk size warning，未扩大范围做拆包。
- 已有测试问题：`repo-inspector-context.test.tsx` 的 11 项中 10 项通过，`edits and saves Why saved and Note as one draft` 按旧英文标签 `Why I saved this` 查找输入框而失败。单独重跑仍失败；从 HEAD 导出未修改的 Web 源码到临时目录，复用已安装依赖执行后在同一位置复现。该测试和 Memory 交互不属于本次改动，未顺手修复。
- 浏览器限制：尝试 ego-browser，但默认沙箱无法连接 `ego_cli bootstrap`，没有形成浏览器验收；未声称完成真实页面视觉验证。
- 边界：未增加依赖，未修改数据库，未提交或部署。
