---
inclusion: always
---

# Tech Stack

## Core
- Next.js 16 (App Router, React Server Components by default)
- React 19 with React Compiler
- TypeScript strict mode — avoid `any`, use explicit return types
- Bun for all package operations (`bun add`, `bun install`, `bun run`)

## Styling
- Tailwind CSS v4 with CSS variables for theming
- Use `cn()` from `@/lib/utils` for conditional class merging

## UI
- shadcn/ui (new-york style) — do not edit `components/ui/` directly
- Radix UI primitives, Lucide React icons
- Framer Motion for animations, Sonner for toasts

## Database
- SQLite via better-sqlite3 + Drizzle ORM
- Schema: `src/lib/db/schema.ts` — use Drizzle's inferred types
- Never edit migrations manually; use `bun db:generate`

## Key Libraries
| Library | Purpose |
|---------|---------|
| date-fns | Date manipulation |
| chrono-node | Natural language date parsing |
| fuse.js | Fuzzy search |
| uuid | ID generation |
| next-themes | Dark/light mode |

## Testing
- Bun test runner with fast-check for property-based tests
- Test files: `*.property.test.ts` suffix

## Commands
```bash
bun dev           # Dev server
bun build         # Production build
bun test          # Run tests
bun lint          # ESLint
bun db:generate   # Generate migrations
bun db:migrate    # Run migrations
bun db:push       # Push schema changes
```
