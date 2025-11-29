---
inclusion: always
---

# Tech Stack

## Core Framework
- Next.js 16 with App Router (React Server Components by default)
- React 19 + React Compiler
- TypeScript strict mode
- Bun runtime for all operations

## TypeScript Rules
- Never use `any` — use `unknown` with type guards if needed
- Always provide explicit return types on functions
- Prefer Drizzle inferred types: `typeof tasks.$inferSelect`
- Use `@/*` path alias for all `src/` imports

## Styling
- Tailwind CSS v4 with CSS variables for theming
- Use `cn()` from `@/lib/utils` for conditional class merging

## UI Components
- shadcn/ui (new-york style) — **never edit `components/ui/` directly**
- Radix UI primitives for accessibility
- Lucide React for icons
- Framer Motion for animations
- Sonner for toast notifications

## Database
- SQLite via better-sqlite3 + Drizzle ORM
- Schema source of truth: `src/lib/db/schema.ts`
- Use Drizzle inferred types, not manual interfaces
- **Never edit `src/lib/db/migrations/` manually** — use `bun db:generate`

## Key Libraries

| Library | Purpose | Usage |
|---------|---------|-------|
| date-fns | Date manipulation | Formatting, comparisons |
| chrono-node | NLP date parsing | Natural language input |
| fuse.js | Fuzzy search | Task/label search |
| uuid | ID generation | Primary keys |
| next-themes | Theme switching | System preference default |
| fast-check | Property testing | Test data generation |

## Testing
- Bun test runner with fast-check for property-based tests
- Test file naming: `*.property.test.ts`
- Colocate tests with source files in same directory

## Commands
```bash
bun dev           # Dev server (port 3000)
bun build         # Production build
bun test          # Run all tests
bun lint          # ESLint check
bun db:generate   # Generate migrations from schema
bun db:migrate    # Apply migrations
bun db:push       # Push schema changes directly
```

## Package Management
- Always use `bun add` for dependencies
- Always use `bun add -d` for dev dependencies
- Never use npm/yarn/pnpm
