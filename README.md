# Daily Task Planner

A modern task management app built with Next.js 16, featuring a clean dark mode interface, smart scheduling, and comprehensive task organization.

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![React](https://img.shields.io/badge/React-19-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)
![Bun](https://img.shields.io/badge/Bun-runtime-orange)

## Features

- **Multiple Views** — Today, Next 7 Days, Upcoming, and All Tasks
- **Custom Lists** — Organize tasks with colors and emoji icons (default Inbox always available)
- **Labels** — Cross-list categorization with icons
- **Subtasks** — Break down complex work into manageable pieces
- **Recurring Tasks** — Daily, weekly, monthly, yearly, or custom patterns
- **Time Tracking** — Estimate and actual time in HH:mm format
- **Priority Levels** — High, Medium, Low, None with visual indicators
- **Fuzzy Search** — Find tasks by name, description, or labels
- **Natural Language Input** — "Lunch with Sarah at 1 PM tomorrow"
- **Smart Scheduling** — AI-assisted time slot suggestions
- **Task History** — Track all modifications with timestamps
- **Reminders** — Push, email, or in-app notifications
- **Dark/Light Mode** — System preference default with toggle
- **Responsive Design** — Desktop split view, mobile-friendly with collapsible sidebar

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 16 (App Router, RSC) |
| Runtime | Bun |
| Language | TypeScript (strict mode) |
| Database | SQLite + Drizzle ORM |
| Styling | Tailwind CSS v4 |
| UI Components | shadcn/ui + Radix UI |
| Animations | Framer Motion |
| State | TanStack Query |
| Date Handling | date-fns, chrono-node |
| Search | Fuse.js |
| Testing | Bun test + fast-check |

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (v1.0+)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd daily-task-planner

# Install dependencies
bun install

# Initialize the database
bun db:push

# (Optional) Seed with sample data
bun db:seed
```

### Development

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Scripts

| Command | Description |
|---------|-------------|
| `bun dev` | Start development server |
| `bun build` | Production build |
| `bun start` | Start production server |
| `bun lint` | Run ESLint |
| `bun test` | Run tests |
| `bun db:generate` | Generate Drizzle migrations |
| `bun db:migrate` | Apply migrations |
| `bun db:push` | Push schema directly to DB |
| `bun db:studio` | Open Drizzle Studio |
| `bun db:seed` | Seed database with sample data |

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/                # API routes
│   ├── today/              # Today view
│   ├── next-7-days/        # Next 7 days view
│   ├── upcoming/           # Upcoming view
│   ├── all/                # All tasks view
│   ├── list/[listId]/      # List view
│   └── search/             # Search results
├── components/
│   ├── ui/                 # shadcn/ui primitives
│   ├── common/             # Shared components
│   ├── layout/             # Sidebar, MainPanel
│   └── tasks/              # Task-specific components
├── lib/
│   ├── db/                 # Drizzle schema & migrations
│   ├── services/           # Business logic
│   ├── hooks/              # React Query hooks
│   └── utils/              # Helpers
└── types/                  # TypeScript types
```

## License

MIT
