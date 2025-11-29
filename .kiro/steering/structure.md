---
inclusion: always
---

# Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # Root layout with providers
│   ├── page.tsx            # Home page
│   ├── globals.css         # Global styles & Tailwind
│   └── [feature]/          # Feature routes (pages, API routes)
│
├── components/
│   ├── ui/                 # shadcn/ui primitives (DO NOT edit directly)
│   ├── theme-provider.tsx  # Dark mode provider
│   └── [feature]/          # Feature-specific components
│
├── lib/
│   ├── db/
│   │   ├── schema.ts       # Drizzle schema definitions
│   │   ├── index.ts        # Database connection
│   │   ├── seed.ts         # Database seeding
│   │   └── migrations/     # Generated migrations (DO NOT edit manually)
│   ├── services/           # Business logic layer
│   │   └── *.service.ts    # Service modules (e.g., list.service.ts)
│   ├── utils/              # Utility functions
│   │   └── validation.ts   # Input validation helpers
│   └── utils.ts            # Shared utilities (cn, etc.)
│
├── types/
│   └── index.ts            # Shared TypeScript types
│
└── hooks/                  # Custom React hooks

data/                       # SQLite database files (gitignored)
public/                     # Static assets
```

## Path Aliases

- `@/*` → `./src/*`

## Architecture Patterns

### Component Organization
- Server Components are the default; use `'use client'` directive only when needed
- Colocate feature components with their routes when possible
- Keep UI primitives in `components/ui/`; create feature components elsewhere

### Service Layer
- Business logic lives in `lib/services/*.service.ts`
- Services handle data operations and enforce business rules
- Import services via `@/lib/services`

### Database Layer
- Schema defined in `lib/db/schema.ts` using Drizzle ORM
- Use `db` export from `@/lib/db` for queries
- Never edit migration files manually; use `bun db:generate`

## Code Conventions

### Imports
- Always use `@/` path alias for src files
- Group imports: external packages → internal modules → relative imports

### File Naming
- Components: PascalCase (e.g., `TaskCard.tsx`)
- Services: kebab-case with `.service.ts` suffix (e.g., `list.service.ts`)
- Tests: same name with `.property.test.ts` suffix for property-based tests
- Types: export from `@/types` for shared types

### TypeScript
- Strict mode enabled; avoid `any` types
- Define explicit return types for functions
- Use Drizzle's inferred types for database entities
