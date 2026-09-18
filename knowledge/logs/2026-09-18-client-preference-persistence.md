# Client preference persistence: theme pre-paint and interface language

Date: 2026-09-18
ADR: 0040

## Outcome

- 主题：`ThemeProvider` 读取改为白名单校验 + `try/catch`，写入同样容错；`packages/ui` 导出 `THEME_STORAGE_KEY` 作为唯一键名来源。
- `apps/web/index.html` 的 `<head>` 新增内联首帧脚本，解析阶段即应用已保存的 `dark` class 与 `colorScheme`，消除刷新时的主题闪烁。
- 语言：`apps/web/src/i18n/index.ts` 读写 `asterism-language`，新增 `changeInterfaceLanguage()` 统一持久化；初始化时恢复存储值并同步 `<html lang>`，非法或未存储时回落到 `en`。
- 顶栏 `LanguageToggle` 与 Settings 语言下拉改走同一持久化入口。
- 新增 `theme-bootstrap.test.ts`、`theme-provider.test.tsx`、`i18n/language-preference.test.ts` 覆盖首帧脚本、主题读写与语言恢复。

## Verification

- `pnpm lint`：285 个文件通过（含 `index.html` 内联脚本）。
- `pnpm test`：`@asterism/core` 81、`@asterism/db` 41、`@asterism/web` 190 全部通过。
- 真实浏览器（ego-browser，`localhost:5173/settings`）：
  - 修复前刷新轨迹为 10 个亮色帧后翻转；修复后第 1 个动画帧起即为 `dark: true` / `colorScheme: dark`。
  - 顶栏切换与 Settings 下拉切换均写入 `asterism-language`，刷新后标题仍为「设置」、`<html lang>` 为 `zh-CN`；切回英文写入 `en`。
- 门禁缺口：`pnpm typecheck` 在干净工作树上即失败于 `apps/web/src/data/use-semantic-neighborhood.ts:94`（`EmbeddingAvailability` 不含 `'unsupported'`），与本轮改动无关，已记入 BACKLOG。
