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
│   ├── ui/                 # shadcn/ui primitives (do not edit directly)
│   ├── theme-provider.tsx  # Dark mode provider
│   └── [feature]/          # Feature-specific components
│
├── lib/
│   ├── db/
│   │   ├── schema.ts       # Drizzle schema definitions
│   │   ├── index.ts        # Database connection
│   │   └── migrations/     # Generated migrations
│   └── utils.ts            # Shared utilities (cn, etc.)
│
└── hooks/                  # Custom React hooks (alias: @/hooks)

data/                       # SQLite database files (gitignored)
public/                     # Static assets
```

## Path Aliases
- `@/*` → `./src/*`

## Conventions
- Use `@/` imports for all src files
- Client components must have `'use client'` directive
- Server components are the default
- Colocate feature components with their routes when possible
- Keep UI primitives in `components/ui/`, feature components elsewhere
