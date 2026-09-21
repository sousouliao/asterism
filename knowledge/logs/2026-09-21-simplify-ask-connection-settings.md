# 2026-09-21 · Ask 设置项精简（移除活跃连接与模型冗余项）

## 目标

Ask Asterism 底部输入框已具备聚合跨 Provider 已验证模型的快捷切换能力（选模型即自动切换对应连接并更新已选模型）。Settings 页面底部的「活跃连接」下拉框与「模型」只读/下拉行心智重叠且冗余，直接移除，将模型与连接的调度完全收敛到 Ask 输入框的模型切换器中；同时保持连接列表完全纯净，不额外增加多余的状态标签。

## 变更

- `packages/ui`：
  - 安装并引入 `@radix-ui/react-switch`，新增符合 shadcn/ui 规范的 `Switch` 组件，并在 `@asterism/ui` 导出。
- `ai-connections-manager.tsx`：
  - 移除偏好设置卡片中的「活跃连接」Select 及 Label、两道 Separator、以及「模型」选择/展示区域。
  - 偏好设置卡片中的「在 Ask 上下文中包含笔记」由原本的 `SegmentedControl`（关/开）分段控件替换为标准 shadcn/ui 的 `Switch` 开关。
  - 连接卡片列表保持纯粹的连接信息（名称、有效状态、凭据提示、测试信息）与原有操作（启用/禁用、测试、编辑、删除），不额外添加「使用中」等冗余标签。
  - 清理未使用的组件（`Select`、`Label`、`Separator` 等）与辅助变量（`selectableConnections`、`activeModel`、`NONE_VALUE`）。
- 测试：
  - 更新 `ai-connections-manager.test.tsx`：断言列表不再包含 `Active connection` 与 `In use`；断言 Switch 禁用状态；出网披露同意测试通过创建有效连接流程验证。

## 验证

- `ai-connections-manager.test.tsx` 8 例全绿。
- `settings.test.tsx` 与 `use-ai-connections.test.tsx` 16 例全绿。
- `pnpm lint` 检查 350 个文件通过，零错误。
- `pnpm test` 全项目 52 个测试套件、272 个单测全绿。
