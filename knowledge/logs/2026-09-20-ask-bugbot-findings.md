# 2026-09-20 · Ask Bugbot 修复

## 背景

对 Ask 常驻底部输入区相关改动跑 Bugbot，两项 medium finding：升级用户丢失 Ask 同意；fixed dock 挡住页面底部点击。

后一项被误修成布局占位，把主内容顶离底部。Ask dock 的产品形态是浮在页面上的 overlay，不是把内容列缩短的页脚。该误修已撤回。

## 变更

- **v1 同意迁移**：`readAskConsent` 不再只删 `asterism:ask-byok:v1:*`。先把出网同意绑到 ai-settings 的活跃连接（或唯一匹配连接），再删除含明文 key 的 v1 快照；key 仍只从连接库现取。Provider 不一致或多连接无法唯一绑定时不猜测，只清快照。
- **dock 仍是浮层**：外层全宽 `pointer-events-none`，只有舱体 `pointer-events-auto`，两侧页面点击不受影响。不测量舱高、不在 AppLayout 留底部空带。

## 验证

- 新增 ask-byok 迁移用例与 dock 点击穿透用例。
- `pnpm lint` / `typecheck` / `test` 针对撤回占位后的改动复跑。
