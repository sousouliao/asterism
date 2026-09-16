# Asterism

> Your private memory for open-source software.

**Asterism** is an open-source, self-deployable personal memory for open-source
software. GitHub Stars are its first source: sync the projects you once noticed,
keep private context about them, and retrieve the right repository when it matters.

> Status: **Memory Foundation is the current frontier.** The responsive Web app,
> real Supabase flows, recoverable manual bulk workflows, invisible hybrid search,
> Related Stars, Collections, and Notes are implemented. Issue #37 will establish
> Memory as the first-class personal context model. Browser extension and desktop
> remain planned, after the Memory and Retrieval foundations are stable. Contracts
> and roadmap live in
> [`knowledge/`](knowledge/).

---

## Why Asterism

GitHub Stars capture that something looked useful, but not why it mattered or how
to find it again months later. Asterism keeps that private context beside the
repository and makes your past attention retrievable. An *asterism* is a recognizable
pattern picked out of countless stars: the name remains a metaphor for turning
scattered attention into memory, not a promise of a star-map interface.

## Features

A short overview — see [`knowledge/contracts/product.md`](knowledge/contracts/product.md)
for the authoritative feature scope and acceptance criteria.

- **Sync your stars** from GitHub and keep them up to date.
- **Private context** through Collections and Notes today, evolving into one Memory
  per repository in the current foundation phase.
- **Search & filtering** across repository name/description, language, topics,
  collections, star count, update time, and archive status.
- **Stats dashboard** to understand your stars at a glance.
- **Import / export** so your data stays yours.
- **Private semantic retrieval** — browser-generated embeddings power invisible
  hybrid search and Related Stars without a hosted AI provider.
- **i18n** — English by default, with built-in Simplified Chinese (`zh-CN`).

## Tech stack

- **Language:** TypeScript (strict)
- **UI:** React + Tailwind CSS + shadcn/ui, `react-i18next`
- **State / data:** TanStack Query, Zustand, Supabase Postgres
- **Backend:** Supabase (Auth + Postgres + Edge Functions)
- **Web:** Vite + React + React Router
- **Extension (later):** WXT (MV3)
- **Desktop (later):** Tauri 2
- **Tooling:** Node 22 · pnpm · Turborepo · Biome · Vitest · Changesets · lefthook + commitlint

See [`knowledge/contracts/architecture.md`](knowledge/contracts/architecture.md)
for the full architecture contract.

## Monorepo layout

A Turborepo + pnpm workspace. The current repository contains the Web app,
shared packages, future platform shells, migrations, and deployed-function source.

```text
asterism/
├── apps/
│   ├── web/          # Responsive web SPA (Vite + React) — first target
│   ├── extension/    # Browser extension (WXT, MV3) — later
│   └── desktop/      # Desktop app (Tauri 2) — later
├── packages/
│   ├── core/         # Business logic: GitHub API, sync, domain models
│   ├── ui/           # Shared UI components (shadcn/ui + Tailwind)
│   ├── db/           # Data access: Supabase client + queries
│   └── config/       # Shared config
├── supabase/         # Migrations + Edge Functions
└── knowledge/        # Single source of truth: contracts, decisions, loops, state, logs
```

## Project knowledge & pointers

- **[`knowledge/`](knowledge/)** — the single source of truth. Contracts,
  decisions (ADRs), roadmap, loops, durable state, and run logs all live here.
  Start any work by reading the contracts and `knowledge/state/PROGRESS.md`.
- **[`CONTRIBUTING.md`](CONTRIBUTING.md)** — dev setup, commit conventions, and
  how to keep the knowledge base in sync.
- **[`AGENTS.md`](AGENTS.md)** — the entry contract for AI agents working in this repo.
- **Self-host runbook** — [`knowledge/runbooks/self-host.md`](knowledge/runbooks/self-host.md).

## License

[MIT](LICENSE) © 2026 Mournerliao

---

## 中文简介

**Asterism** 是一个开源、可自部署的个人开源软件记忆库。GitHub Stars 是首个来源：
同步曾经关注的项目，保存只有自己知道的上下文，并在真正需要时重新找到它们。

> 当前状态：**Memory Foundation 是当前开发 frontier。** 响应式 Web、真实 Supabase
> 核心链路、可恢复手动批量操作、隐形混合搜索、Related Stars、Collection 与 Note 已落地；
> #37 将把 Memory 建立为一等个人上下文。浏览器扩展和桌面端保留，但延后到 Memory / Retrieval
> 基础稳定之后。架构与路线图见 [`knowledge/`](knowledge/)。

- 功能、技术栈与目录结构详见上文英文部分，权威功能范围见
  [`knowledge/contracts/product.md`](knowledge/contracts/product.md)。
- 知识库 [`knowledge/`](knowledge/) 为**单一事实源**；任何工作请先阅读
  `contracts/` 与 `knowledge/state/PROGRESS.md`。
- 贡献方式见 [`CONTRIBUTING.md`](CONTRIBUTING.md)，自托管见
  [`knowledge/runbooks/self-host.md`](knowledge/runbooks/self-host.md)，AI 代理约定见
  [`AGENTS.md`](AGENTS.md)。
- 国际化：默认英文，内置简体中文（`zh-CN`）。开源协议：MIT。
