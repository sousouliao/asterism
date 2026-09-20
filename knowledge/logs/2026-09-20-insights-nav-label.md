# 2026-09-20 · 洞察页用户面名称统一

## 目标

侧栏导航写「仪表盘」，页面标题写「洞察」，同一表面露出两套名字。统一为 Insights / 洞察。

## 变更

- `nav.dashboard`：zh-CN `仪表盘` → `洞察`；en `Dashboard` → `Insights`。
- 登录卖点去掉 dashboard / 仪表盘：en `Insights into your starred repositories`，zh-CN `Star 仓库的可视化洞察`。
- 空状态描述「查看统计」改为「查看洞察」，与 loading / error 文案对齐。
- `conventions.md` 增补术语：用户面正式名称是 Insights / 洞察；内部路由与代码标识可继续用 `dashboard`。
- `ui-ux.md` / `product.md` 同步注明用户面名称，避免契约继续把「仪表盘」当产品名。

## 后续

同日将侧栏顺序改为浏览 → 洞察 → 集合 → 导入 / 导出 → 设置（`NAV_ITEMS` 对调洞察与集合）。`ui-ux.md` 记录该顺序，避免集合作为次级组织入口再排回洞察前面。

## 验证

- `pnpm --filter @asterism/web test -- src/i18n/locales.test.ts` 通过。
- 未做浏览器视觉验收：刷新后侧栏与页面标题应同为「洞察」/「Insights」，且洞察在集合上方。
