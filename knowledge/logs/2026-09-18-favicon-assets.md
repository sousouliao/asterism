# Favicon source assets

## Context

仓库此前没有任何图片资源，`index.html` 也没有 `<link rel="icon">`，浏览器标签页是空白默认图标。需要一整套图标，但 `BrandLogo` 是 24×24 viewBox、1px 描边、连线 38% 不透明度的应用内标记，直接缩到 16px 会糊成一团；同时 `apps/web/public` 并不被服务——Vite 的 `publicDir` 被 embedding 资产占用（`.cache/embedding-assets/v1/public`）。

## Changes

- 新增 `apps/web/public/favicon.svg`：与 `BrandLogo` 同拓扑（5 节点 + 5 连线），按 16px 可辨识度调整字重（连线 `stroke-width` 2.2 / 55% 不透明度、节点半径 2.05 与 2.9，画布 32×32），颜色用字面值并通过 SVG 内 `prefers-color-scheme` 在 `#2563eb` / `#60a5fa` 间切换（favicon 读不到 `--brand`）。
- 新增 `apps/web/public/favicon-tile.svg`：实心品牌蓝铺满 + 白色标记，标记占画布 56%、落在 Android maskable 的 80% 安全圆内，供 iOS / Android 应用图标位使用。
- 新增 `apps/web/scripts/sync-public.mjs`，并在 `predev` / `build` 中先于 embedding 脚本执行：把 `apps/web/public` 覆盖复制到真正的 public 根目录，使仓库里的静态资源在 dev 与 build 都生效。
- `index.html` 增加 `<link rel="icon" type="image/svg+xml" href="/favicon.svg">`；待 RealFaviconGenerator 产出的整套资源落地后，用其完整片段替换本行。

## Verification

- 用小尺寸对比选定形制：0.38 / 0.55 / 0.72 三档连线不透明度加"去节点 / 去连线"两版，在 16px（白底、`#DEE1E6` 浅色标签栏、`#2B2B2B` 深色标签栏）与 32 / 64px 下逐版渲染对比。结论：保留全部 5 个节点（与产品内标记同形）并把连线抬到 55%；去掉中间节点虽然更干净但破坏了"星群"轮廓，纯节点无连线则读作噪点。
- 用 headless Chrome 逐尺寸渲染确认：标记在 16 / 32 / 64px 清晰，深色偏好下自动切换为 `#60a5fa`；实心 tile 变体在 32px 以上可用、16px 偏糊，因此 tile 只用于应用图标位，不做标签页图标。
- `curl` 确认 dev server 与 `dist/` 都以 `image/svg+xml` 在站点根提供两个文件；页面内 `new Image()` 加载成功（32×32）。
- Impeccable detector、`pnpm lint`、`pnpm typecheck`、`pnpm test`（web 205）、`pnpm build` 通过。

## Follow-up

整套图标由 RealFaviconGenerator 生成（上传 `favicon.svg` 作主图）。下载的 zip 解到 `apps/web/public/` 后重跑 `node apps/web/scripts/sync-public.mjs` 即可生效。

## Integration（zip 落地）

RealFaviconGenerator 产出的 zip 已解到 `apps/web/public/`：

| 文件 | 背景 | 用途 |
| --- | --- | --- |
| `favicon.svg` | 透明 + 主题色切换 | 主图 / 标签页（沿用仓库内带注释的源文件，未采用 zip 里被压缩并写入 RDF 元数据的那一份，几何与样式完全相同） |
| `favicon.ico` | 透明（16 / 32 / 48 三帧） | 旧浏览器与 PDF 等按约定查找 `favicon.ico` 的场景 |
| `favicon-96x96.png` | 透明 | 高 DPI 标签页 / 书签 |
| `apple-touch-icon.png` | 白底 180 | iOS 主屏 |
| `web-app-manifest-192x192.png` / `-512x512.png` | 白底，`purpose: maskable` | Android / PWA 安装 |

`site.webmanifest` 的占位值（`MyWebSite` / `MySite` / `#ffffff`）已替换为 Asterism：`name` / `short_name` 为品牌名、`description` 用 `app.tagline`、`start_url: "/"`、`display: standalone`，`theme_color` 与 `background_color` 取应用画布色 `#f5f6f8`（跟随应用外观，而不是让状态栏变成品牌蓝——与"克制用蓝"的配色策略一致；代价是深色系统的启动屏仍是浅色）。

`index.html` 写入与 zip 文件集一一对应的图标片段（96 PNG / SVG / shortcut ico / apple-touch 180 / `apple-mobile-web-app-title` / manifest）。

验证：

- 逐帧解析 `favicon.ico` 确认三帧（48 / 32 / 16）均为 32bpp 全透明背景，角落与中心 alpha=0，标记本身不透明。
- 采样 PNG 角落像素：`favicon-96x96.png` alpha=0（透明），三个应用图标 alpha=255（白底），符合上面的分工。
- 七个文件在 dev server 与 `dist/` 均以正确 Content-Type 从站点根返回（`site.webmanifest` 为 `application/manifest+json`）。
- 页面内逐项加载声明的图标与 manifest 内图标，`naturalWidth` 与声明尺寸一致。
- 像素采样验证主题切换：`prefers-color-scheme: light` 下节点为 `#2563eb`，`dark` 下为 `#60a5fa`。
- 模拟标签栏（16px，浅色 `#dee1e6` / 深色 `#2b2b2b`）与主屏图标（iOS 圆角 / Android 圆形 maskable / 96px 透明）视觉检查。
