# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

`wsop` is an **internal private-deployment customer maintenance-record system**（私有化维护客户记录系统）—
a customer-centric ledger for ops staff to record how often and when each enterprise customer's deployed
software was maintained, plus per-customer file space, RBAC user management, and audit logging.

It is a **pnpm monorepo**:
- `apps/desktop` — **Tauri 2** desktop client (**React 19 + TypeScript + Vite + Tailwind v4 + Radix UI**). The
  client connects to the central server over HTTP. Targets Windows primarily (the Rust shell links many
  `Win32_*` features via the `windows` crate).
- `apps/server` — central **Rust / Axum** backend (SQLx + **SQLite** file DB, WAL mode + server-side file
  storage). *Built in M1; may not exist yet.*
- `packages/shared` — TS types generated from the backend DTOs via `ts-rs`. *Built in M2; may not exist yet.*

The full implementation plan lives at `~/.claude/plans/tranquil-brewing-sedgewick.md` (milestones M0–M7).
M0 = monorepo + rename (done). Roles: **admin / engineer / viewer**.

## Commands

This project uses **pnpm workspaces**. Run from the repo root unless noted.

- `pnpm dev` (alias `pnpm tauri:dev`) — run the desktop client: `pnpm --filter wsop-desktop tauri dev`. Main
  dev loop; auto-runs Vite via `beforeDevCommand`. **Vite dev port is 1430** (strict port — fails if taken;
  `devUrl` in `tauri.conf.json` must match).
- `pnpm desktop:build` — typecheck (`tsc`) + Vite build of the desktop app. **`tsc` is the only typecheck/lint
  gate** — no ESLint/Prettier. TS is strict with `noUnusedLocals`/`noUnusedParameters`, so unused imports/vars
  fail the build.
- `pnpm tauri:build` — full production desktop bundle.
- `pnpm server:dev` / `pnpm server:build` — run/build the Axum backend (once `apps/server` exists).
- Target a workspace package directly with `pnpm --filter wsop-desktop <script>`.

There is **no JS test framework** configured.

## Architecture

### Client/server split
The desktop app is a **thin client**: it authenticates against `apps/server` (JWT), and all customers,
deployments, maintenance records, files, and audit logs live in the server's SQLite DB behind the Axum API. Multi-user
collaboration (assignment, shared file space, cross-user audit) is why a central server exists rather than
local-only storage.

### Desktop two-process split (within `apps/desktop`)
- **Frontend** (`src/`): React renders the entire UI, including window chrome. The OS title bar is disabled
  (`decorations: false` in `src-tauri/tauri.conf.json`); window controls live in `src/components/layout/WindowControls.tsx`.
- **Rust shell** (`src-tauri/src/lib.rs`): the Tauri entry. `main.rs` calls `wsop_lib::run()`. All Rust setup
  (plugins, tray, window-event handling) lives in `lib.rs`. The crate is `wsop` / lib `wsop_lib`.

### App shell (reused for all pages)
`src/components/layout/` is a free re-implementation of HeroUI Pro's `AppLayout`: `AppLayout.tsx` (scaffold +
context + `useSidebar`/`useAppLayout` hooks + triggers), `Sidebar.tsx` (collapsible icon-rail sidebar parts),
`WindowControls.tsx`. Compose pages by passing `sidebar` / `navbar` / `aside` / children to `<AppLayout>`. The
navbar is the borderless-window drag region (`data-tauri-drag-region`) and hosts the window controls.

### Frontend ↔ Rust boundary
- Window controls use `@tauri-apps/api/window` (`getCurrentWindow()`).
- `invoke_handler` in `lib.rs` is currently **empty** — no custom Rust commands; the client talks to the
  server over HTTP, not via Tauri commands.
- Any new Tauri capability (window method, plugin command, **HTTP scope for the server**) must be allow-listed
  in `src-tauri/capabilities/default.json` or it is rejected at runtime.

### Rust shell behaviors (in `lib.rs::run()`)
- **Single instance**: `tauri-plugin-single-instance` must stay the first plugin (focuses the existing window).
- **Close = hide, not quit**: `CloseRequested` calls `api.prevent_close()` and hides; app stays in the tray.
- **System tray**: built in `.setup()` with Show/Quit; only Quit exits (`app.exit(0)`).
- **Autostart**: `tauri-plugin-autostart` (LaunchAgent mode) registered; enable/disable/is-enabled allow-listed.

### Frontend app structure (`apps/desktop/src`)
- **Routing**: `react-router` v7 hash router (`router.tsx`) — `/login` + a protected shell (`AppShell.tsx`) with
  an `AdminRoute` guard for `/users` and `/audit`. Pages in `pages/`, feature components in `components/`.
- **Server state**: `@tanstack/react-query`; **HTTP**: `lib/api.ts` wraps `@tauri-apps/plugin-http` fetch and
  injects the JWT. Base URL is a **runtime-mutable** module var (`setApiBase`/`getApiBase`), seeded from
  `lib/config.ts` (`VITE_API_BASE`, default `127.0.0.1:8787`) and overridable in the in-app **Settings** modal.
- **Settings**: `stores/settings.ts` (zustand) holds backend URL + theme, persisted via `@tauri-apps/plugin-store`
  (`settings.json`); theme is also mirrored to `localStorage` and applied pre-render (`applyCachedThemeEarly` in
  `main.tsx`) to avoid a flash. The navbar (top-right) has a theme toggle + a gear opening `SettingsModal`.
  Because the URL is user-settable, the HTTP capability scope is **widened to any host** (`http(s)://*`).
- **Auth**: `stores/auth.ts` (zustand); JWT persisted via `@tauri-apps/plugin-store`. `main.tsx` awaits settings
  init **before** auth init so `/auth/me` uses the persisted backend URL.
- **File viewer**: `components/customers/FileViewerModal.tsx` previews files inline (image/pdf via object URL,
  text via `blob.text()`, else download fallback) without leaving the app.
- Shared DTO types come from `@wsop/shared` (ts-rs generated).

### Styling & UI components
- **Tailwind CSS v4** via `@tailwindcss/vite` (no `tailwind.config.js` — CSS-first config in `src/index.css`).
- `src/index.css` is the design system: `@fontsource` fonts (Space Grotesk / Space Mono / Doto) and CSS
  variables for a dark glassmorphic theme with a `.light` mode. Prefer the existing `--color-*` / `--hero-*`
  variables and the `.card` / `.glass-panel` classes over hardcoding colors.
- **Interactive widgets use Radix UI** (`radix-ui` package): `Dialog`/`Select`/`Tabs`/`Switch`, wrapped with the
  dark theme in `components/ui/` (`Modal.tsx`, `Select.tsx`, `Switch.tsx`). Simple controls
  (`primitives.tsx`: Button/Input/Textarea/Badge/Spinner) are styled native elements.
  **Note:** `@heroui/react` is installed but **NOT used** — HeroUI v3.1.0's types don't resolve cleanly under
  this strict-TS/bundler setup (basic `<Button>`/`<Input>` usage errors), so Radix was adopted instead.
- **lucide-react** icons (type icon props as `LucideIcon`); **framer-motion** for the mobile sidebar sheet.
- Tailwind v4 gotcha: `-translate-x-1/2` sets the CSS `translate` property, which **stacks** with any
  `transform: translate(...)` animation — center overlays with flexbox, animate `scale`/`opacity` only.

## Conventions
- Match the dark glassmorphic aesthetic in `index.css` / existing pages when adding UI.
- After changing a backend DTO, run `pnpm shared:gen` to regenerate `packages/shared` types.
- A frontend design skill is vendored under `.agents/skills/design-taste-frontend/` (tracked in `skills-lock.json`).
