# UGC Logistics Integrated Dashboard

Single source of truth untuk monitoring KPI Marketing & Sales, CRM funnel, internal Ticketing (RFQ/Request), serta AR/DSO controlling.

## Tech Stack (LOCKED)

- **Framework**: Next.js 16 App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Components**: shadcn/ui + Radix UI
- **Icons**: lucide-react
- **Database**: Supabase (Postgres + RLS)
- **Auth**: Supabase SSR
- **Deployment**: Vercel

## Color Palette (LOCKED)

| Token     | Hex       | Usage          |
|-----------|-----------|----------------|
| Primary   | #FF4600   | Accent         |
| Secondary | #082567   | Secondary      |
| Danger    | #DC2F02   | Destructive    |
| Dark      | #0F1A2D   | Text           |
| Base      | #FFFFFF   | Background     |

## Top-Level Menu (LOCKED - 5 ONLY)

1. Dashboard
2. KPI
3. CRM
4. Ticketing
5. DSO

## Roles (LOCKED - 15 EXACT)

1. Director
2. super admin
3. Marketing Manager
4. Marcomm (marketing staff)
5. DGO (Marketing staff)
6. MACX (marketing staff)
7. VSDO (marketing staff)
8. sales manager
9. salesperson
10. sales support
11. EXIM Ops (operation)
12. domestics Ops (operation)
13. Import DTD Ops (operation)
14. traffic & warehous (operation)
15. finance

## Getting Started

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.local.example .env.local
# Edit .env.local with your Supabase credentials

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## Database Setup

### Applying Migrations

Run all migrations in order against your Supabase instance:

```bash
# Via Supabase CLI
supabase db push

# Or manually via SQL Editor in Supabase Dashboard:
# Execute files in supabase/migrations/ in order:
# 00_schema.sql -> 01_seed.sql -> 02_rls.sql -> ... -> 08_seed_qa.sql
```

### QA Testing Data

For QA and development testing, apply the seed data migration:

```sql
-- Run in Supabase SQL Editor
-- File: supabase/migrations/08_seed_qa.sql
```

This creates:
- 12 test user profiles (across all roles)
- 5 sample customers
- 9 sample leads (various statuses)
- 5 sample prospects
- 7 sample invoices (various aging buckets)
- Sample payments, tickets, sales activities
- Sample KPI targets and actuals

**Note:** Test users have deterministic UUIDs starting with `00000000-...`. In production, users are created via Supabase Auth.

### Offline Installation

For environments without network access:

1. Build a `node_modules` cache on a network-connected machine:
   ```bash
   npm ci
   tar -czf node_modules.tar.gz node_modules
   ```

2. Transfer `node_modules.tar.gz` to the offline environment

3. Extract and use:
   ```bash
   tar -xzf node_modules.tar.gz
   npm run build
   ```

## Build Verification

```bash
# Type check
npx tsc --noEmit

# Lint
npm run lint

# Build
npm run build
```

## Project Structure

```
ugc-integrated-dashboard/
â”œâ”€â”€ app/                    # Next.js App Router
â”‚   â”œâ”€â”€ (auth)/            # Auth route group
â”‚   â”œâ”€â”€ api/               # Route Handlers (BFF/Proxy)
â”‚   â”œâ”€â”€ dashboard/         # Dashboard pages
â”‚   â”œâ”€â”€ kpi/               # KPI module
â”‚   â”œâ”€â”€ crm/               # CRM module
â”‚   â”œâ”€â”€ ticketing/         # Ticketing module
â”‚   â””â”€â”€ dso/               # DSO module
â”œâ”€â”€ components/
â”‚   â”œâ”€â”€ layout/            # AppShell, Sidebar, Topbar
â”‚   â”œâ”€â”€ ui/                # shadcn/ui components
â”‚   â”œâ”€â”€ table/             # Data tables
â”‚   â”œâ”€â”€ filter/            # FilterBar, SavedViews
â”‚   â””â”€â”€ charts/            # Recharts components
â”œâ”€â”€ lib/
â”‚   â”œâ”€â”€ supabase/          # Supabase clients
â”‚   â”œâ”€â”€ rbac/              # Role & permission logic
â”‚   â””â”€â”€ utils/             # Utility functions
â”œâ”€â”€ supabase/
â”‚   â””â”€â”€ migrations/        # SQL migrations
â”œâ”€â”€ docs/                  # Documentation
â”‚   â”œâ”€â”€ diagrams.mmd       # Mermaid diagrams
â”‚   â””â”€â”€ validator.json     # Validation rules
â””â”€â”€ public/
    â””â”€â”€ fonts/             # Lufga font files
```

## Documentation

- [BLUEPRINT.md](./BLUEPRINT.md) - Full system specification
- [docs/diagrams.mmd](./docs/diagrams.mmd) - System diagrams
- [docs/validator.json](./docs/validator.json) - Validation rules

## License

Proprietary - UGC Logistics
