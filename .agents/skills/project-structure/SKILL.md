---
name: "project-structure"
description: "Explains the StockMarket project layout and the feature-based (structure-by-feature) conventions used across the backend (Express + TypeScript) and frontend (Next.js 14 + TypeScript + Tailwind). Use when adding, moving, or organizing code."
---

# Project Structure Skill

StockMarket is a stock portfolio tracker split into two apps that both follow a
**structure-by-feature** organization. Code is grouped by business capability
(transaction, dividends, portfolio, charts, watch-list, ...) rather than by
technical layer.

## Repository Layout

```
StockMarket/
├── backend/    # Express + TypeScript REST API
├── frontend/   # Next.js 14 (App Router) + TypeScript + Tailwind CSS
└── .agents/    # Rules and skills for the agent
```

## Backend (`backend/src`)

Express + TypeScript API. Tech: `express`, `pg` (PostgreSQL), `yahoo-finance2`,
`multer`, `helmet`, `morgan`. Tests use `jest` + `supertest` + `fast-check`.

```
backend/src/
├── app.ts                 # Express app wiring (middleware, routes)
├── index.ts               # Server entry point
├── cache/                 # In-memory caching helpers
├── db/                    # Pool, constants, and Postgres repositories
├── features/              # One folder per business feature
│   ├── charts/            # chart.service, stock.routes, yahoo-finance.client
│   ├── dividends/         # *.repository, *.routes, *.service
│   ├── exchange-rate/
│   ├── export/
│   ├── import/
│   ├── portfolio/
│   ├── slips/             # OCR + slip parsing
│   ├── tickers/
│   ├── transaction/
│   └── watch-list/
├── routes/                # Cross-feature route integration tests
├── services/              # Cross-feature unit + property tests
└── types/                 # Shared TypeScript types
```

### Feature conventions (backend)

Each feature folder typically contains:

- `*.routes.ts` — Express router; HTTP concerns only (parse, validate, respond).
- `*.service.ts` — Business logic; no direct HTTP or SQL details.
- `*.repository.ts` / `postgres-*.repository.ts` — Data access (Postgres via `pg`).
- `*.client.ts` — External API clients (e.g. Yahoo Finance).

Keep the flow `routes → service → repository/client`. Routes should not contain
business logic, and services should not depend on Express request/response objects.

## Frontend (`frontend/src`)

Next.js 14 App Router. Tech: `react` 18, `@reduxjs/toolkit`, `react-redux`,
`recharts`, `lightweight-charts`, Tailwind CSS. Tests use `vitest` +
`@testing-library/react` + `fast-check`.

```
frontend/src/
├── app/                   # App Router routes (one folder per page)
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home (portfolio dashboard)
│   ├── chart/
│   ├── dividends/
│   ├── transactions/
│   └── watchlist/
├── components/            # UI components grouped by feature
│   ├── chart/
│   ├── dividends/
│   ├── export/
│   ├── import/
│   ├── layout/            # Shared layout (e.g. Sidebar)
│   ├── portfolio/
│   ├── transactions/
│   ├── watchlist/
│   └── ui/                # Reusable primitives (ErrorBanner, Skeleton, Toast...)
├── store/                 # Redux Toolkit store, api, middleware
│   └── slices/            # Feature state slices
└── test/                  # Test setup (setup.ts)
```

### Feature conventions (frontend)

- Feature-specific components live in `components/<feature>/`. Shared, generic
  primitives go in `components/ui/`.
- Each component has a colocated test: `Component.tsx` + `Component.test.tsx`.
- Routes in `app/<feature>/` compose components from `components/<feature>/`.
- Global state goes in `store/slices/`; API access in `store/api.ts`.

### Where to add new code

- **New backend capability** → create `backend/src/features/<feature>/` with
  `*.routes.ts`, `*.service.ts`, and a repository/client as needed, then register
  the router in `app.ts`.
- **New frontend feature** → add `components/<feature>/` for UI, a route under
  `app/<feature>/` if it needs a page, and a slice in `store/slices/` if it needs
  state.

## Common Commands

Backend (`backend/`):
- **Dev:** `npm run dev`
- **Build:** `npm run build`
- **Test:** `npm test`
- **Lint:** `npm run lint`

Frontend (`frontend/`):
- **Dev:** `npm run dev`
- **Build:** `npm run build`
- **Test:** `npm test`
- **Lint:** `npm run lint`

> Run dev servers manually in your own terminal; they are long-running processes.

## Related

- Coding rules: `.agents/rules/rule.md`
- Docker workflow: `.agents/skills/docker-deploy/SKILL.md`
