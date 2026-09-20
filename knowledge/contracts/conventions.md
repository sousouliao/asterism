# Conventions Contract · 规范契约

> 本文件定义编码、目录边界、提交、i18n、发布工程、包管理与安全规范。它是工程层 verification 的依据：代码评审与 CI 都应以此裁定合规与否。规范变更须同步更新本文件并记录 ADR。

## Coding · 编码规范

- **TypeScript strict**：`tsconfig.base.json` 开启严格模式；禁止隐式 `any`，避免无谓的类型断言。
- **Biome 统一 lint + format**：以 Biome 同时承担 TypeScript、TSX、JSON 与 CSS 的格式化和静态检查，单一工具、单一配置，避免 ESLint/Prettier/Stylelint 多栈冲突。Tailwind v4 CSS 启用 `css.parser.tailwindDirectives: true`；提交前由 lefthook 的 `pre-commit` 自动跑 Biome。
- **CSS 规则例外必须精确**：reduced-motion 等确需 `!important` 的无障碍规则可做行级或文件内精确抑制，不得全局关闭 `noImportantStyles`，也不得把全部 CSS 排除出门禁。
- **跨平台换行统一为 LF**：仓库通过 `.gitattributes` 固化文本文件为 LF，Windows 干净检出不得因 CRLF 转换导致 Biome 格式检查失败。
- **不写叙述性注释**：禁止"// 导入模块""// 自增计数器"这类复述代码的注释。注释只用于解释非显而易见的意图、取舍或约束；不要用注释解释你做了什么改动。
- **kebab-case 文件名**：源文件名在适用处使用 kebab-case（如 `sync-stars.ts`、`repo-card.tsx`）。React 组件用 PascalCase 命名，但文件名仍用 kebab-case。

## Directory Boundaries · 目录职责边界

跨包依赖必须单向、清晰，禁止把平台专有 API 渗入共享包。

- **业务逻辑 → `packages/core`**：GitHub API、同步、领域模型等都在 core，与 UI / 平台无关。
- **UI → `packages/ui`**：所有可复用组件、设计系统在 ui；遵循 `ui-ux.md` 设计契约。
- **数据访问 → 仅经 `packages/db`**：Supabase 客户端与查询是持久数据访问的**唯一入口**；其他包不得直接拼 SQL 或直连 Supabase。
- **共享包不含平台专有 API**：`core` / `ui` / `db` 不得引用 `chrome.*`、Tauri、Node 专有或浏览器扩展专有 API；平台差异留在 `apps/*` 内适配。

## Commit Convention · 提交规范

- **Conventional Commits**：用 commitlint + `@commitlint/config-conventional` 校验。
- **subject 英文、body 中文**：subject 形如 `type(scope): 英文摘要`（如 `feat(core): add incremental star sync`），正文 body 用中文详述背景与取舍。
- **git 钩子由 lefthook 管理**：`commit-msg` 跑 commitlint，`pre-commit` 跑 Biome；**第一次提交即生效**（见 `../decisions/0003-commitlint-lefthook.md`）。
- **绝不绕过钩子**：禁止使用 `--no-verify` / `--no-gpg-sign` 等方式跳过校验。

## i18n · 国际化

- **全部用户可见文案外部化**：禁止在组件中硬编码用户可见字符串，一律走翻译资源。
- **默认 en + 内置 zh-CN**：用 react-i18next（跨 web / 扩展通用、最稳），默认英文，内置简体中文。
- **界面语言由客户端持久化**：用户显式选择写入 `asterism-language`（仅接受内置 locale），跨会话与刷新恢复；未存储或取值非法时回落默认 `en`，首访不做浏览器语言探测。写入必须走统一入口，不得在组件里直接调用 `i18n.changeLanguage()` 而绕过持久化。
- **新增文案同步两种语言**：新增任何 key 必须同时提供 en 与 zh-CN 文案。
- **简体中文混排留白**：`zh-CN` 的自然语言文案在汉字与拉丁字母、英文缩写或拉丁插值之间使用一个半角空格，并由 locale 测试阻止粘连回归；仓库名、`owner/name`、URL、文件名、代码、版本号及 README 原文等技术标识内部不得机械改写。阿拉伯数字与中文量词 / 单位继续遵循 locale 原生输出，不在全局文本层强制插空格。
- **术语大小写一致**：同一 locale 内的英文产品术语保持统一大小写；简体中文界面的 GitHub 收藏概念统一写作 `Star`，正式能力名可写作 `GitHub Stars`。
- **洞察页用户面名称**：该表面的正式名称是 `Insights` / `洞察`。导航项、页面标题与登录卖点必须使用同一名称，不得再对用户露出 `Dashboard` / `仪表盘`。内部路由与代码标识可继续用 `dashboard`。

## Release Engineering · 发布工程

- **Changesets**：用 Changesets 管理版本与 changelog。
- **包 scope `@asterism/*`**：所有包统一命名空间。
- **共享包私有 workspace（不发布）**：`core` / `ui` / `db` / `config` 等为私有 workspace 包（`"private": true`），暂不发布到 npm；Changesets 仅用于内部版本与 changelog 管理。
- Phase 1 不要求正式 semver、Changelog 或 Git tag；生产部署以 Git commit 与部署记录追溯。首个公开版本前再单独验收 Changesets、tag 与 release notes 流程。

## Verification Gates · 验证门禁

- Phase 1 收尾及后续阶段验收必须在干净检出中通过 `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`。
- 四道门禁必须同时通过；平台换行、生成物或本地工具缓存造成的失败也必须修复或在配置中正确隔离，不得把失败解释为可忽略的环境噪声。
- Phase 1 使用 Vitest：纯逻辑、数据映射与错误分支走单元测试；Query hooks、组件、路由与 Edge Function handler 走集成测试。
- GitHub OAuth、provider token、真实 RLS 与已部署 Edge Function 走真实环境 smoke test。Phase 1 不引入 E2E 工具，也不设置覆盖率百分比；核心旅程出现重复回归或进入跨端阶段时再重新评估自动化 E2E。
- 构建工具的 chunk size warning 本身不阻断阶段验收，也不得通过抬高阈值来掩盖。只有 Core Web Vitals、低端设备加载时间、流量或平台成本等真实指标表明问题时，才按指标驱动拆包优化。

## Package Manager · 包管理

- **pnpm**：以 pnpm 作为唯一包管理器，`packageManager` 字段锁定版本；配合 Turborepo。
- **选型理由**：见 `../decisions/0002-pnpm-over-bun.md`。
- **已知 footgun（记录备查）**：曾评估 Bun。Bun workspaces 与 Vite 配合时存在**传递性 CJS 依赖提升（transitive CJS hoisting）**的坑——某些只被间接依赖的 CJS 包未被正确提升 / 预构建，导致 Vite dev 阶段报模块解析或 `does not provide an export` 类错误，叠加 Turborepo 对 lockfile 版本较敏感，整体不够稳妥。**缓解办法（若未来重新考虑 Bun 时备用）**：在 Vite 配置中用 `optimizeDeps.include` 显式声明这些传递性 CJS 依赖，强制预构建。当前选 pnpm 即为规避此类不确定性。

## Database Migrations · 数据库迁移

- `supabase/migrations/*.sql` 是 schema、索引、触发器与 RLS policy 的唯一来源，所有环境必须按顺序应用同一组 migrations。
- 禁止只在 Supabase Dashboard 手工修改线上 schema 或 policy。紧急手工修复后必须立即补等价 migration，恢复仓库与环境一致。
- `database.types.ts` 在 Phase 1 可继续手写维护；是否切换为 Supabase CLI 生成类型不阻断阶段验收。

## Security · 安全

- **绝不提交任何密钥**：禁止把 token / API key / service role 等写入仓库或日志。
- **`.env` 不入库**：环境变量经 `.env` 本地配置，`.gitignore` 忽略；仓库只提供 `.env.example` 占位（无真实值）。
- **不保存 AI Provider credential**：AI 整理与 BYOK Connection 已退役；运行时、数据库和部署配置不得重新引入对应凭据或服务端 Generation 调用，除非先通过新的 ADR 重新立项。
- **同步更新知识库**：任何代码 / 配置 / 架构变更，都必须同步更新 `knowledge/`（契约、状态、必要时 ADR），保持单一事实源不漂移。
