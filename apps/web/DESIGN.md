# Design

> **Source of truth**: `knowledge/contracts/ui-ux.md` (repo root). This file is an **alignment layer** for Impeccable; never edit values here without updating the contract first. Color/material decisions are recorded in ADR 0009, typography/spacing in ADR 0007. Tokens live in `packages/ui/src/styles/globals.css`.

## Design Language

- **Visual system**: Asterism Graphite Glass. 带品牌蓝色相的石墨中性色 + 单一电光蓝；磨砂玻璃只用于交互层，内容面板保持实体表面。
- **Base**: shadcn/ui + Tailwind CSS. Reuse `packages/ui` components before building new ones; new components must land in `packages/ui` and follow these tokens.
- **Theming**: light + dark are both first-class; default follows OS preference, explicit toggle available, persisted per user.

## Color

Authoritative values + full CSS block in `ui-ux.md` § Design Tokens. Core roles (hex, light → dark):

| Role | Light | Dark |
|---|---|---|
| `--background` | `#F5F6F8` | `#0B0E13` |
| `--foreground` | `#161A22` | `#F2F4F7` |
| `--card` | `#FCFCFD` | `#12161D` |
| `--primary` | `#2563EB` | `#2563EB` |
| `--secondary` / `--muted` | `#E9EDF3` / `#EDF0F4` | `#1A2029` / `#171C24` |
| `--destructive` | `#D13B43` | `#E0525A` |
| `--border` / `--input` | `#D7DBE2` / `#CCD2DC` | `#2A303A` / `#353C48` |
| `--ring` / `--link` | `#3B82F6` / `#1E54C7` | `#60A5FA` / `#6EA8FE` |
| `--glass-surface` | `rgba(252,252,253,.72)` | `rgba(18,22,29,.68)` |

Color strategy: **Restrained** — blue is reserved for primary actions, current selection, links, focus and info; success/warning/destructive have independent semantic colors. Language colors are limited to small coding marks; large chart areas use the blue scale. ADR 0035 does not give collections a color palette.

## Typography

- **Fonts**: `"Geist Variable"` (sans, body/UI), `"Geist Mono Variable"` (numbers/dates).
- **Scale** (desktop): display 28px/Bold → page-title 24px/Bold → section-title 20px/SemiBold → drawer-title 16px/SemiBold → Repo Inspector name 18px/SemiBold → body 14px/1.25 line-height → caption 12px/1rem line-height → micro 11px/0.875rem line-height. Table headers use micro/Medium; Activity and Inspector compact metadata use micro/Regular.
- **Weights**: Regular 400 · Medium 500 · SemiBold 600 · Bold 700.
- **Simplified Chinese mixed text**: keep one half-width space between Han text and Latin terms, abbreviations, or Latin interpolations. Never rewrite repository names, URLs, code, or README source text globally.
- Full scale + usage mapping in `ui-ux.md`.

## Spacing & Layout

- **4px grid**: xs 4 · sm 8 · md 12 · lg 16 · xl 20 · 2xl 24 · 3xl 32.
- **Heading cluster**: title + optional badge + one-line description + optional actions stay together. Title ↔ description is xs (`gap-1` / 4px); cluster → body is lg (`gap-4` / 16px); page sections stack at 2xl (`gap-6` / 24px). Centered empty/login clusters may use sm (8px). Never `gap-0.5` or `mb-4` between a heading and its own description. Section titles use `--text-section-title`, never `text-base`.
- `AppLayout` main content region is `flex flex-col overflow-hidden`; individual pages own their own scroll region (`flex-1 min-h-0 overflow-y-auto`), Browse page uses a fixed header + scrolling list split. Never add `position: sticky` or extra `main` padding to work around this — follow the pattern already in `ui-ux.md` § Scrollbar.
- Custom thin-pill scrollbar (`--scrollbar-size: 8px`, always visible, theme-aware via `color-mix`) — reuse, don't reinvent per-component scrollbars.

## Radius

Base `--radius: 0.5rem` (8px), shadcn standard derivation: `sm` 4px (badges/tags) · `md` 6px (buttons/inputs/nav items) · `lg` 8px (cards/drawers) · `xl` 12px (large containers).

## Motion

- Product feedback uses 120–240ms transitions and `--ease-out-quart`; Quick Look uses a 220ms source transition and 120ms content crossfade, while modal entrances stay within 300ms.
- Buttons and segmented controls use a subtle translate/scale/brightness press response. No page-load choreography, bounce or elastic curves; `prefers-reduced-motion` collapses transitions.

## Components

- **Base**: shadcn/ui primitives + Tailwind, from `packages/ui`.
- **Richer libraries, scoped use only**: shadcn Charts/Recharts for the insights dashboard; Magic UI / Aceternity permitted **only** in marketing surfaces (none currently in `apps/web`, which is entirely product register) — never in core app UI.
- **Glass boundary**: allowed for Topbar, search/filter controls, segmented controls and portal overlays; forbidden for Repo Card, chart body and primary content sections.
- **Anti-patterns to avoid** (see `PRODUCT.md` Anti-references): gradient text, side-stripe borders, decorative glass cards, identical card grids, hero-metric template, uppercase eyebrows / 01-02-03 markers.
- Cards are not the default affordance — Browse's card view is a deliberate mode (toggle vs. list/table), not a reflexive "wrap everything in a card" pattern.

## Dark Mode

Both themes are equal citizens. Dark depth comes from the `#0B0E13 → #12161D → #151A22` surface ramp, not wide shadows. Ardot remains a historical layout reference, not the current color authority.

## Accessibility

Target **WCAG 2.1 AA**: ≥4.5:1 body text contrast, ≥3:1 large text, visible focus ring (`--ring`), keyboard operability, semantic markup/ARIA, accessible virtualized lists (TanStack Virtual).

## Brand Assets

- Wordmark: "Asterism". The constellation mark is monochrome electric blue with lower-opacity connecting lines; no blue-purple gradient or decorative glow.
