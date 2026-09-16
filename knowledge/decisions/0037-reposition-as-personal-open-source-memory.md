# ADR 0037 · 将 Asterism 定位为 Personal Open Source Memory

- Status: Accepted
- Date: 2026-09-17
- Builds on: ADR 0026、0027、0032、0035、0036
- Background: `../proposals/asterism-transformation-roadmap.md`

## Context

Asterism 已经交付 GitHub Stars 同步、Collection、Note、混合搜索、Related Stars、浏览器内 embedding 与可靠批量写入，但权威契约仍把产品终点描述为“更好地管理 Star”，并把浏览器扩展列为下一阶段。这会继续把工程投入引向更多整理入口，而没有回答更重要的问题：用户为什么收藏某个项目，以及需要时如何重新找到并理解它。

长期提案还包含 Snapshot、Research、MCP、Constellation 等多个方向。它们尚无真实 Memory 数据或使用证据，不能随产品定位一起获得实现授权。

## Decision

Asterism 的产品定义调整为：**your private memory for open-source software**。它是开源、可自部署的个人开源软件记忆层，首个来源是用户自己的 GitHub Stars。

- **Star 是来源，不是终点。** Star 同步触发基础 Memory；系统不猜测用户当时的原因。
- **Memory 是用户与 Repo 的一等关系。** 首版每个 `user × repo` 一条 Memory，承载来源、来源时间、`whySaved` 与自由文本 `note`。
- **Collection 是次级人工组织能力。** 保留现有数据、浏览和维护能力，但暂停新增 Collection Management 功能。
- **Retrieval 是后续主路径。** 复用现有关键词/语义混合搜索、Related Stars、浏览器内 embedding、同步与可靠写入；统一 Retrieval 必须在 Memory Foundation 完成并产生使用证据后另行立项。
- **当前 frontier 是 Memory Foundation。** 浏览器扩展与桌面端保留为未来客户端，但延后到 Memory / Retrieval 基础稳定以后。
- **Contracts 优先于提案。** 长期 Transformation Roadmap 只保存方向背景；Accepted ADR、Contracts 和具体 issue 才授权实现。

当前没有真实用户数据，因此 Memory Foundation 采用一次性干净 cutover：迁移旧 Note，退役旧表与查询，不建立 feature flag、双写或长期兼容层。导入格式兼容属于数据可携带性，不属于双写。

## Near-term non-goals

Memory Foundation 期间不实现 AI Chat、联网搜索、RepoSnapshot、Research Session、MCP、动态 Constellation、Taste Graph、Idea Collision 或二维星图 UI，也不恢复服务端 BYOK Generation / AI 整理。

## Consequences

- 产品和 UI 文案以“记住、找回和理解曾关注的软件”为中心，而不是以分类数量或整理效率作为终点。
- Repo Quick Look 的下一次功能改造必须把 Memory 作为主要个人上下文；原因为空时明确显示未记录，不进行 AI 补全。
- 现有 Collection、Search、Related Stars、embedding、Notes 与同步链路是迁移资产，不因定位调整而删除。
- 远期阶段只保留在提案中；在前置能力产生真实证据前不创建实现 issue。
