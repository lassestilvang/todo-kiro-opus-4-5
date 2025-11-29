# Tech Stack

## Core Framework
- Next.js 16 (App Router, React Server Components)
- React 19 with React Compiler enabled
- TypeScript (strict mode)

## Package Manager
- Bun (use `bun` for all package operations)

## Styling
- Tailwind CSS v4
- CSS variables for theming
- `cn()` utility from `@/lib/utils` for class merging

## UI Components
- shadcn/ui (new-york style)
- Radix UI primitives
- Lucide React icons
- Framer Motion for animations
- Sonner for toast notifications

## Database
- SQLite via better-sqlite3
- Drizzle ORM for type-safe queries
- Schema defined in `src/lib/db/schema.ts`

## Key Libraries
- date-fns for date manipulation
- chrono-node for natural language date parsing
- fuse.js for fuzzy search
- uuid for ID generation
- next-themes for dark mode

## Testing
- Bun test runner
- fast-check for property-based testing

## Common Commands
```bash
bun dev          # Start dev server
bun build        # Production build
bun start        # Start production server
bun lint         # Run ESLint
bun test         # Run tests

# Database
bun db:generate  # Generate migrations
bun db:migrate   # Run migrations
bun db:push      # Push schema changes
bun db:studio    # Open Drizzle Studio
```
