# 2026-09-21 · Ask Asterism 输入框占位文案调整

## 目标

将底部 Ask dock 输入框的占位文案从「用自然语言提问…」/「Ask in your own words…」调整为「Ask Asterism…」，与产品品牌及统一的输入框省略号规范对齐。

## 变更

- `apps/web/src/i18n/locales/zh-CN.json`：`ask.placeholder` 改为 `Ask Asterism…`。
- `apps/web/src/i18n/locales/en.json`：`ask.placeholder` 改为 `Ask Asterism…`。

## 验证

- `pnpm --filter @asterism/web test -- src/i18n/locales.test.ts` 通过（验证双语 key 对称与排版规范）。
- `pnpm --filter @asterism/web test -- src/components/ask/ask-panel.test.tsx` 通过。
- `pnpm lint` 与全量 `pnpm test` 通过。
