# ADR 0040 · 客户端偏好持久化（主题首帧应用与界面语言存储）

- Status: Accepted
- Date: 2026-09-18
- Preserves: ADR 0005 / 0007 的 Graphite Glass tokens；ui-ux 契约「用户主题偏好由客户端持久化，不依赖服务端设置表」

## Context

用户报告「主题和语言好像都没存到 localStorage」。在真实浏览器中核对后，两个问题的性质不同：

- **主题**：`asterism-theme` 一直在被写入，也能跨刷新恢复。但 `dark` class 由 `ThemeProvider` 的 `useEffect` 在挂载后才应用，而 `index.html` 没有任何首帧脚本。实测一次刷新里前 10 个动画帧（约 170 ms）以亮色绘制，之后才翻转为暗色。观感等同于「主题没保存」。
- **语言**：完全没有持久化。`apps/web/src/i18n/index.ts` 固定 `lng: 'en'`，`i18n.changeLanguage()` 只改运行时状态，刷新后立刻回到英文。
- 另外 `ThemeProvider` 直接 `window.localStorage.setItem`，在私密模式或配额耗尽时抛出异常会让主题切换本身失效；读取也没有校验存储值。

## Decision

- **主题**：保留 `asterism-theme` 作为唯一键（`packages/ui` 导出 `THEME_STORAGE_KEY`），在 `apps/web/index.html` 的 `<head>` 内联一段同步脚本，在解析阶段读取该键并应用 `dark` class 与 `colorScheme`。`ThemeProvider` 仍是运行时真源，挂载后继续负责系统主题变化与 class 同步。读写统一加 `try/catch`，读取时按 `light | dark | system` 白名单校验，非法值回落到系统偏好。
- **语言**：新增 `asterism-language` 键，只接受内置 locale（`en`、`zh-CN`）。写入集中在 `changeInterfaceLanguage()`，由顶栏切换器与 Settings 下拉共用；初始化时读取该键，未存储或取值非法时回落到默认 `en`，并把结果同步到 `<html lang>`。
- **键形态**：两个键都只存单个枚举 token，不做 JSON、不加版本前缀；`zh-CN` 混排与 `i18nextLng` 等第三方键不参与。以取值白名单校验替代 schema 版本管理（对照 react-best-practices 的 `client-localstorage-schema` 规则，本场景没有需要版本迁移的字段结构）。
- **不引入语言自动探测**：首访仍按契约默认英文；只有用户显式切换才写入偏好。

## Consequences

- 刷新不再出现「先亮后暗」的主题闪烁；语言选择跨会话保留。
- 「未存储」与「显式选择 en」语义不同：显式选择会写入 `en`，这也是 `asterism-language` 会在用户切换后出现的原因。
- 键名同时出现在 `index.html` 与 `packages/ui`：由 `apps/web/src/theme-bootstrap.test.ts` 断言两者一致，防止任何一侧单独改名造成静默回落到默认主题。
- 偏好继续是纯客户端状态。换用户或清空 storage 会回到 system + en，不尝试从 Supabase 会话恢复，符合 ui-ux 契约「不依赖服务端设置表」。
- 主题加载早期仍有极短窗口由样式表默认亮色兜底（脚本执行前 `document.documentElement` 尚不存在），但不再有已渲染帧使用错误主题。
