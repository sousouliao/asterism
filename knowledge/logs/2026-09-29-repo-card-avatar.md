# 2026-09-29 · 仓库卡片语言色点升级为拥有者/项目头像

## 背景与需求

用户希望将仓库卡片（`RepoCard`）左上角紧邻 `owner / name` 的圆点修改为项目或开发者头像（Owner / Repository Avatar），以提升卡片在浏览时的辨识度与现代感。

## 现状剖析

原先红框处的圆点代码为：
```tsx
const dotColor = languageColor(repo.language);
// ...
<span
  aria-hidden="true"
  className={cn('size-2.5 shrink-0 rounded-full', !dotColor && 'bg-muted-foreground')}
  style={dotColor ? { backgroundColor: dotColor } : undefined}
/>
```
该圆点原为仓库主要编程语言标识（如 TypeScript 显示为蓝色）。但卡片标题旁没有头像，且 10px 的语言色点在视觉传达上信息相对微弱。

## 改造方案

1. **零后端改动的数据接入**：
   - GitHub 官方提供稳定的公共 Avatar CDN：`https://github.com/${repo.owner}.png?size=40`。
   - 复用现有 `record.repo.owner`，无需增加数据库字段或重新同步历史 Star 仓库。
2. **UI 规范与 Graphite Glass 设计对齐**：
   - 提取 `RepoOwnerAvatar` 子组件，复用 `@asterism/ui` 中的 `Avatar`, `AvatarImage`, `AvatarFallback`（基于 `@radix-ui/react-avatar`）；
   - 尺寸定为 `size-5`（20px），与标题行行高（20px）精准对齐，维持卡片 208px 紧凑高度；
   - 采用 `rounded-full` 与 `border border-border/50 bg-muted/40`，保证暗色模式下透明/纯黑背景 Logo 边缘轮廓清晰；
   - 启用 `loading="lazy"` 与 `decoding="async"` 保障海量卡片虚拟滚动性能；
   - 优雅降级：图片加载中或网络离线时呈现大写首字母 Fallback；
   - 无障碍适配：增加 `aria-hidden="true"` 与 `alt=""`，避免辅助技术重复朗读 owner 文本。
3. **测试覆盖**：
   - 在 `apps/web/src/components/repo-card.test.tsx` 中增加头像渲染与首字母 Fallback 测试用例。

## 验证

- `pnpm --filter @asterism/web test`：通过（23 个套件，124 个测试全部通过）。
- `pnpm test`：全 monorepo 测试全部通过（55 个套件，300 项测试全部通过）。
- `pnpm lint`：Biome 零报错。
