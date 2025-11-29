---
inclusion: always
---

# Tech Stack

Next.js 16 (App Router, RSC default) · React 19 + Compiler · TypeScript strict · Bun runtime

## TypeScript

- **Never** use `any` — use `unknown` with type guards
- Explicit return types on all functions
- Prefer Drizzle inferred types: `typeof tasks.$inferSelect`
- Use `@/*` path alias for all `src/` imports

## Styling & UI

- Tailwind CSS v4 with CSS variables; use `cn()` from `@/lib/utils` for class merging
- shadcn/ui (new-york style) — **never edit `components/ui/`**
- Radix UI for accessibility, Lucide React for icons
- Framer Motion for animations, Sonner for toasts

## Database

- SQLite via better-sqlite3 + Drizzle ORM
- Schema source of truth: `src/lib/db/schema.ts`
- **Never edit `src/lib/db/migrations/`** — run `bun db:generate`

## Key Libraries

| Library | Purpose |
|---------|---------|
| date-fns | Date formatting/comparisons |
| chrono-node | NLP date parsing |
| fuse.js | Fuzzy search |
| uuid | Primary key generation |
| next-themes | Theme switching (system default) |
| fast-check | Property-based testing |

## Testing

- Bun test runner + fast-check
- Naming: `*.property.test.ts`, colocated with source

## Commands

```bash
bun dev          # Dev server :3000
bun build        # Production build
bun test         # Run tests
bun lint         # ESLint
bun db:generate  # Generate migrations
bun db:migrate   # Apply migrations
bun db:push      # Push schema directly
```

## Package Management

Use `bun add` / `bun add -d` only — never npm/yarn/pnpm
