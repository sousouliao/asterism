# AGENTS.md

Asterism is an open-source, self-deployable personal memory for open-source
software. GitHub Stars are its first source; responsive web is the current
surface, while browser extension and desktop are deferred until the Memory and
Retrieval foundations are stable. This file is the entry contract for any AI
agent working in this repository.

## Single source of truth

**`knowledge/` is the single source of truth.** It is plain, tool-agnostic
markdown organized for Loop Engineering (contracts, decisions, roadmap, loops,
durable state, logs).

Before doing any task, **read first**:

1. `knowledge/contracts/` — what "correct" and "done" mean (product,
   architecture, data-model, conventions, ui-ux).
2. `knowledge/state/PROGRESS.md` — current progress and where to resume.

If the request conflicts with the contracts, surface the conflict instead of
silently diverging.

## Loop discipline

- **Execute** per the loop definitions in `knowledge/loops/`.
- **Completion is judged by acceptance criteria in `knowledge/contracts/`** —
  not by "it looks done." Verify against the relevant contract before stopping.
- **On finishing**, update `knowledge/state/` (PROGRESS / NOTES / BACKLOG) and
  append a record to `knowledge/logs/`.
- **Record important decisions** as ADRs in `knowledge/decisions/` (one decision
  per file: context, trade-offs, conclusion).

## Project skills

Project-approved agent skills are governed by `knowledge/skills/` and vendored
under `.agents/skills/`. Before applying a skill, read its `SKILL.md` and any
referenced rule or reference files needed for the task.

- Use `.agents/skills/react-best-practices/SKILL.md` for React components,
  hooks, TanStack Query, bundle/performance, rendering performance, and client
  data-fetching work.
- Use `.agents/skills/composition-patterns/SKILL.md` for `packages/ui`,
  reusable component APIs, provider/context design, compound components, and
  component refactors.
- Use `.agents/skills/vercel-cli-with-tokens/SKILL.md` for Vercel CLI work that
  involves `VERCEL_TOKEN`, project linking, environment variables, deployment
  inspection, or domain management.
- Use `.agents/skills/deploy-to-vercel/SKILL.md` for Vercel preview/production
  deployments and deployment URL retrieval.
- Use `.agents/skills/vercel-optimize/SKILL.md` only for post-deployment Vercel
  cost/performance audits backed by real Vercel metrics.
- Use `.agents/skills/impeccable/SKILL.md` for UI design, redesign, shape,
  colorize, critique, audit, polish, responsive, interaction, and motion work.
  Run its project context loader against the concrete app target before acting.

If a vendored skill conflicts with `knowledge/contracts/*`, the Asterism
contracts win. Never commit secrets while following deployment-related skills.

## Runtime baseline

Node 22 · pnpm · Turborepo · Biome · Vitest. Do not introduce alternative
runtimes, package managers, or test/lint tools without an ADR.

## Directory boundaries

- **Business logic** → `packages/core`.
- **UI** → `packages/ui`.
- **Data access** → only via `packages/db` (Supabase client, queries, local
  cache). No direct data access scattered across apps.
- **Shared packages** (`core`, `ui`, `db`, `config`) must **not** contain
  platform-specific APIs (no `chrome.*`, no Tauri, no DOM-only assumptions where
  shared). Platform code belongs in `apps/*`.

## Conventions

- **TypeScript strict** everywhere.
- **Biome** for lint and format (`pnpm lint` / `pnpm format`); do not add other
  linters/formatters.
- **Avoid narrating comments.** Comments explain non-obvious intent or
  trade-offs, never restate the code.

## UI rules

- Follow the design tokens and rules in `knowledge/contracts/ui-ux.md`.
- **Never invent new styles** or ad-hoc colors/spacing/typography — use the
  defined tokens and components.
- **Generate UI via `knowledge/loops/ui-generation.loop.md`**: produce with the
  approved workflow, align to the ui-ux contract, review, then land in
  `packages/ui` and pass accessibility checks.

## Internationalization (i18n)

- **Externalize all user-facing strings.** No hardcoded UI text.
- Locales: **English (`en`, default) + Simplified Chinese (`zh-CN`)** from the
  start. Add keys for both.

## Releases

- Versioning and changelogs via **Changesets**.
- Packages use the **`@asterism/*`** scope. Shared packages are currently private
  workspace packages (not published to npm).

## Commit rules

- **Conventional Commits**, auto-checked by **commitlint + lefthook**.
- **Subject in English**: `type(scope): short summary`.
- **Body in Chinese (中文)**: explain the *why*.
- **Never bypass hooks** (no `--no-verify` / skipping commit-msg or pre-commit).

## Security guardrails

- **Never commit secrets.** No API keys, tokens, or credentials in the repo.
- **`.env` is never committed** (only `.env.example` is tracked).
- **BYOK keys are encrypted at rest** — never store user API keys in plaintext.
- **Keep `knowledge/` in sync** with every behavior/scope/decision change; a
  change that does not update the knowledge base is incomplete.

## Agent skills

### Issue tracker

Issues live in the repo's GitHub Issues, driven by the `gh` CLI. External PRs are
**not** a triage surface. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical roles map 1:1 to default label strings (`needs-triage`,
`needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See
`docs/agents/triage-labels.md`.

### Domain docs

Single-context; domain language lives in `knowledge/contracts/` and ADRs in
`knowledge/decisions/` (per the `knowledge/` single-source-of-truth convention).
See `docs/agents/domain.md`.
