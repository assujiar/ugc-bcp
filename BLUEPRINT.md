# BLUEPRINT
## UGC Logistics Integrated Dashboard
(Next.js 16 App Router + Supabase Postgres/RLS/RPC + Vercel)

---

## 1. Executive Summary

UGC Logistics Integrated Dashboard adalah **single source of truth** untuk monitoring KPI Marketing & Sales, CRM funnel, internal Ticketing (RFQ/Request), serta AR/DSO controlling.  
Produk ini **tidak terintegrasi dengan API eksternal** (GA4, Ads, Meta, Google Ads). Seluruh metrik marketing yang tidak berasal dari data internal dikumpulkan melalui **manual input tools + bulk import**.

**Scope utama:**
1. KPI Marketing & Sales (auto-calc + manual/import).
2. CRM (Leads Ã¢â€ â€™ Customers Ã¢â€ â€™ Prospects).
3. Ticketing internal (Inquiry Tariff, General Request, Pickup, Delivery).
4. Response time & SLA monitoring.
5. DSO & AR controlling.

**Non-goals (explicit):**
- Tidak ada integrasi API eksternal (analytics/ads).
- Tidak ada public-facing portal.
- Tidak ada pricing engine / quotation calculator otomatis.
- Tidak ada role/menu di luar yang didefinisikan.

---

## 2. Fixed Constraints (LOCKED)

### 2.1 Roles (Exact, Tidak Boleh Ditambah)
Total **15 roles**, persis:
- Director  
- super admin  
- Marketing Manager  
- Marcomm (marketing staff)  
- DGO (Marketing staff)  
- MACX (marketing staff)  
- VSDO (marketing staff)  
- sales manager  
- salesperson  
- sales support  
- EXIM Ops (operation)  
- domestics Ops (operation)  
- Import DTD Ops (operation)  
- traffic & warehous (operation)  
- finance  

Jika ada role lain Ã¢â€ â€™ **OUTPUT INVALID**.

---

### 2.2 Top-Level Menu (Exact)
Sidebar **hanya**:
1. Dashboard  
2. KPI  
3. CRM  
4. Ticketing  
5. DSO  

Tidak boleh ada menu lain.  
Subpage **boleh**, top-level **tidak**.

---

### 2.3 Sidebar Visibility Rule (KRITIS)
- Sidebar **hanya menampilkan menu yang boleh diakses** oleh role login.
- **Tidak ada** menu disabled / greyed out.
- Mapping visibility berbasis RBAC server-side.

---

### 2.4 Tech Stack (Non-Deprecated)
- Next.js **16** App Router (RSC + Route Handlers).
- TypeScript.
- Tailwind CSS.
- shadcn/ui + Radix UI.
- lucide-react icons.
- Supabase:
  - `@supabase/supabase-js` v2
  - `@supabase/ssr`
- Deployment: Vercel.

---

### 2.5 Auth Architecture (WAJIB)
- **NO Next.js Middleware gating**.
- Auth via **Supabase SSR session**.
- Sensitive operations:
  - create/update
  - bulk import
  Ã¢â€ â€™ lewat **Route Handlers (BFF/Proxy)**.
- Client-side direct read ke Supabase **boleh**, **selama RLS benar**.
- Service Role Key **tidak pernah** di-expose ke client.

---

### 2.6 UI / UX Constraints
- Light theme.
- Glassmorphism.
- Modern SaaS dashboard.
- Sidebar tipis (fixed desktop).
- Topbar: search + filter entrypoint.
- Cards, charts, tables rapi.
- Border radius: **14Ã¢â‚¬â€œ18px**.
- Responsive:
  - Desktop: sidebar fixed.
  - Mobile: drawer + bottom-sheet filter.

---

### 2.7 Color Palette (LOCKED)
Hanya token berikut:
- `#FF4600` (primary accent)
- `#082567` (secondary)
- `#DC2F02` (danger)
- `#0F1A2D` (text/dark)
- `#FFFFFF` (base)

Opacity diperbolehkan.  
Hue baru **dilarang**.

---

### 2.8 Font
- Primary: **Lufga**.
- Implementasi:
  - Local font asset (`/public/fonts`) + CSS `@font-face`.
  - Fallback: `Inter`, `system-ui`, `sans-serif`.

---

## 3. High-Level Architecture

### 3.1 App Structure
- Next.js App Router.
- Server Components sebagai default.
- Client Components hanya untuk interaksi (tables, forms, charts).
- Route Handlers (`app/api/*`) sebagai **BFF layer**.

```
Client UI
   |
   | (RSC fetch / client fetch)
   v
Next.js Server (RSC)
   |
   | (Route Handlers - Proxy/BFF)
   v
Supabase Postgres (RLS enforced)
```

---

### 3.2 Data Access Strategy
- **READ (safe)**:
  - Client Ã¢â€ â€™ Supabase (anon key).
- **WRITE / MUTATION**:
  - Client Ã¢â€ â€™ Route Handler Ã¢â€ â€™ Supabase.
- Semua rule akses **di DB (RLS)**, bukan di UI.

---

## 3.3 Dynamic Route Parameter Naming Convention

**IMPORTANT:** All dynamic route segments must follow this naming convention to avoid collisions and maintain consistency:

### Naming Rules
- Use `<table_name>_id` format for all entity identifiers
- Examples: `[invoice_id]`, `[customer_id]`, `[lead_id]`, `[ticket_id]`, `[user_id]`, `[view_id]`
- Never use generic `[id]` segments
- Parameter names should match the primary key column name in the database

### Current Dynamic Routes
| Route | Parameter | Entity |
|-------|-----------|--------|
| `/api/invoices/[invoice_id]` | `invoice_id` | Invoice |
| `/api/invoices/[invoice_id]/payments` | `invoice_id` | Invoice payments |
| `/api/customers/[customer_id]` | `customer_id` | Customer |
| `/api/leads/[lead_id]` | `lead_id` | Lead |
| `/api/leads/[lead_id]/assign` | `lead_id` | Lead assignment |
| `/api/tickets/[ticket_id]` | `ticket_id` | Ticket |
| `/api/saved-views/[view_id]` | `view_id` | Saved view |
| `/api/users/manage/[user_id]` | `user_id` | User management |

### Next.js 15+ Params Handling
In Next.js 15+, route handler params are passed as a Promise and must be awaited:

```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ invoice_id: string }> }
) {
  const { invoice_id } = await params;
  // ... handler logic
}
```

---

## 4. Repository Structure (Final)

```
ugc-integrated-dashboard/
Ã¢â€Å“Ã¢â€â‚¬ app/
Ã¢â€â€š  Ã¢â€Å“Ã¢â€â‚¬ (auth)/
Ã¢â€â€š  Ã¢â€â€š  Ã¢â€â€Ã¢â€â‚¬ login/
Ã¢â€â€š  Ã¢â€Å“Ã¢â€â‚¬ dashboard/
Ã¢â€â€š  Ã¢â€Å“Ã¢â€â‚¬ kpi/
Ã¢â€â€š  Ã¢â€Å“Ã¢â€â‚¬ crm/
Ã¢â€â€š  Ã¢â€Å“Ã¢â€â‚¬ ticketing/
Ã¢â€â€š  Ã¢â€Å“Ã¢â€â‚¬ dso/
Ã¢â€â€š  Ã¢â€Å“Ã¢â€â‚¬ api/
Ã¢â€â€š  Ã¢â€â€š  Ã¢â€Å“Ã¢â€â‚¬ leads/
Ã¢â€â€š  Ã¢â€â€š  Ã¢â€Å“Ã¢â€â‚¬ tickets/
Ã¢â€â€š  Ã¢â€â€š  Ã¢â€Å“Ã¢â€â‚¬ kpi/
Ã¢â€â€š  Ã¢â€â€š  Ã¢â€Å“Ã¢â€â‚¬ imports/
Ã¢â€â€š  Ã¢â€â€š  Ã¢â€Å“Ã¢â€â‚¬ invoices/
Ã¢â€â€š  Ã¢â€â€š  Ã¢â€â€Ã¢â€â‚¬ auth/
Ã¢â€â€š  Ã¢â€â€Ã¢â€â‚¬ layout.tsx
Ã¢â€Å“Ã¢â€â‚¬ components/
Ã¢â€â€š  Ã¢â€Å“Ã¢â€â‚¬ layout/
Ã¢â€â€š  Ã¢â€â€š  Ã¢â€Å“Ã¢â€â‚¬ Sidebar.tsx
Ã¢â€â€š  Ã¢â€â€š  Ã¢â€Å“Ã¢â€â‚¬ Topbar.tsx
Ã¢â€â€š  Ã¢â€â€š  Ã¢â€â€Ã¢â€â‚¬ AppShell.tsx
Ã¢â€â€š  Ã¢â€Å“Ã¢â€â‚¬ ui/ (shadcn)
Ã¢â€â€š  Ã¢â€Å“Ã¢â€â‚¬ table/
Ã¢â€â€š  Ã¢â€Å“Ã¢â€â‚¬ filter/
Ã¢â€â€š  Ã¢â€â€Ã¢â€â‚¬ charts/
Ã¢â€Å“Ã¢â€â‚¬ lib/
Ã¢â€â€š  Ã¢â€Å“Ã¢â€â‚¬ supabase/
Ã¢â€â€š  Ã¢â€â€š  Ã¢â€Å“Ã¢â€â‚¬ server.ts
Ã¢â€â€š  Ã¢â€â€š  Ã¢â€Å“Ã¢â€â‚¬ client.ts
Ã¢â€â€š  Ã¢â€â€š  Ã¢â€â€Ã¢â€â‚¬ auth.ts
Ã¢â€â€š  Ã¢â€Å“Ã¢â€â‚¬ rbac/
Ã¢â€â€š  Ã¢â€â€š  Ã¢â€Å“Ã¢â€â‚¬ roles.ts
Ã¢â€â€š  Ã¢â€â€š  Ã¢â€â€Ã¢â€â‚¬ permissions.ts
Ã¢â€â€š  Ã¢â€â€Ã¢â€â‚¬ utils/
Ã¢â€Å“Ã¢â€â‚¬ supabase/
Ã¢â€â€š  Ã¢â€â€Ã¢â€â‚¬ migrations/
Ã¢â€Å“Ã¢â€â‚¬ docs/
Ã¢â€â€š  Ã¢â€Å“Ã¢â€â‚¬ diagrams.mmd
Ã¢â€â€š  Ã¢â€â€Ã¢â€â‚¬ validator.json
Ã¢â€Å“Ã¢â€â‚¬ public/
Ã¢â€â€š  Ã¢â€â€Ã¢â€â‚¬ fonts/
Ã¢â€Å“Ã¢â€â‚¬ .env.local.example
Ã¢â€Å“Ã¢â€â‚¬ tailwind.config.ts
Ã¢â€â€Ã¢â€â‚¬ package.json
```

---

## 5. Routing Map (Top-Level)

### 5.1 Dashboard
- `/dashboard`
  - Role-based variant:
    - Director: all performance (read-only).
    - Marketing Manager: marketing performance.
    - Marketing staff: my performance.
    - sales manager: sales performance.
    - salesperson: my performance.
    - Ops: ticket SLA + response time.
    - finance: AR/DSO summary.

---

### 5.2 KPI
- `/kpi`
- `/kpi/my`
- `/kpi/team`
- `/kpi/targets`
- `/kpi/input`
- `/kpi/imports`

---

### 5.3 CRM
- `/crm/leads`
- `/crm/customers`
- `/crm/prospects`
- `/crm/imports` (sales support only)

---

### 5.4 Ticketing
- `/ticketing`
- `/ticketing/create`
- `/ticketing/[ticket_id]`

---

### 5.5 DSO
- `/dso`
- `/dso/invoices`
- `/dso/payments`
- `/dso/my-customers` (sales scoped)

---

## 6. RBAC Overview (Summary)

| Role | Dashboard | KPI | CRM | Ticketing | DSO |
|----|----|----|----|----|----|
| Director | R | R | R | R | R |
| super admin | RW | RW | RW | RW | RW |
| Marketing Manager | R | RW | RW | RW | NA |
| Marketing staff | R (own) | W (own) | RW (own leads) | RW | NA |
| sales manager | R | RW | RW | RW | R (scoped) |
| salesperson | R (own) | W (own) | RW (own) | RW | R (scoped) |
| sales support | NA | NA* | R/W assist | RW | NA |
| Ops roles | R (SLA) | NA | NA | RW (dept) | NA |
| finance | R | R (finance KPI) | R | NA | RW |

\* KPI sales support default NA kecuali diaktifkan eksplisit.

---

## 7. RBAC Matrix (Detail) + Sidebar Visibility

### 7.1 Action Codes
- **R**: read
- **W**: write (create/update/close)
- **A**: admin/master (global manage, termasuk user/master data)

### 7.2 Matrix 15 Roles Ãƒâ€” 5 Modules

**Dashboard**
- Director: R (all)
- super admin: R
- Marketing Manager: R (marketing)
- Marcomm (marketing staff): R (my)
- DGO (Marketing staff): R (my)
- MACX (marketing staff): R (my)
- VSDO (marketing staff): R (my)
- sales manager: R (sales team)
- salesperson: R (my)
- sales support: NA
- EXIM Ops (operation): R (ticket SLA/response time)
- domestics Ops (operation): R (ticket SLA/response time)
- Import DTD Ops (operation): R (ticket SLA/response time)
- traffic & warehous (operation): R (ticket SLA/response time)
- finance: R (AR/DSO summary)

**KPI**
- Director: R (all performance)
- super admin: A (global KPI defs, targets, access)
- Marketing Manager: W (marketing KPI settings + targets + assignment), R (team + individual)
- Marcomm/DGO/MACX/VSDO: W (update progress KPI assigned + upload evidence), R (my KPI)
- sales manager: W (set target salesperson + view team), R (team + individual)
- salesperson: W (own KPI + activity + evidence), R (my KPI)
- sales support: NA (default). Jika nanti diputuskan perlu akses, harus konsisten di RBAC + RLS (NA saat ini).
- Ops roles: NA
- finance: R (finance KPI bila ada). Default: R untuk KPI agregat yang relevan finance (misal DSO), tanpa menambah metric baru.

**CRM**
- Director: R (all performance, read-only)
- super admin: A
- Marketing Manager: W (leads management + assign/handover), R (all)
- Marcomm/DGO/MACX/VSDO: W (create/update leads dari channel mereka), R (leads mereka)
- sales manager: W (pipeline team + customers team + leads team), R
- salesperson: W (leads own + customers own + prospects own), R
- sales support: R (leads all sales, prospects all sales), W (customers all sales), plus `/crm/imports` (job/transaction upload)
- Ops roles: NA (masking access hanya lewat Ticketing view)
- finance: R (customer data untuk invoice/AR)

**Ticketing**
- Director: R (performance/read-only)
- super admin: A
- Marketing Manager: W (create/assign/cc/monitor SLA)
- marketing staff: W (create/cancel/update/close)
- sales manager: W
- salesperson: W
- sales support: W
- Ops roles: W (create/update/respond/cancel/close sesuai dept target) + **masked view untuk RFQ yang berasal dari lead**
- finance: NA (tidak wajib, agar scope tidak melebar)

**DSO**
- Director: R (all performance/read-only)
- super admin: A
- finance: W (invoice CRUD + payment + aging + DSO trend)
- sales manager: R (scoped by team customer ownership)
- salesperson: R (scoped by customer ownership)
- Marketing roles: NA
- Ops roles: NA
- sales support: NA

---

### 7.3 Sidebar Visibility Mapping (No Disabled Menu)
Rules:
- Sidebar render berdasarkan hasil `getAllowedMenus(role)` di server (RSC).
- Kalau role tidak punya akses menu: menu **tidak dirender**.
- Director tetap lihat semua top-level menu, tapi seluruh aksi write diblok oleh RLS/proxy guards.

**Allowed top-level menus per role**
- Director: Dashboard, KPI, CRM, Ticketing, DSO
- super admin: Dashboard, KPI, CRM, Ticketing, DSO
- Marketing Manager: Dashboard, KPI, CRM, Ticketing
- Marcomm/DGO/MACX/VSDO: Dashboard, KPI, CRM, Ticketing
- sales manager: Dashboard, KPI, CRM, Ticketing, DSO
- salesperson: Dashboard, KPI, CRM, Ticketing, DSO
- sales support: CRM, Ticketing (KPI/DSO/Dashboard: NA)
- Ops roles: Dashboard, Ticketing
- finance: Dashboard, KPI, CRM, DSO

---

## 8. Auth Architecture (Supabase SSR + Proxy/BFF, No Middleware Gating)

### 8.1 Principle
- Session disimpan di cookie dan di-handle server-side.
- RSC membaca session + profile role untuk menentukan routing & sidebar.
- Semua operasi sensitif (mutations, bulk import) lewat Route Handlers.

Citations (official):
- Next Route Handlers: https://nextjs.org/docs/app/getting-started/route-handlers
- Next file convention route.ts: https://nextjs.org/docs/app/api-reference/file-conventions/route
- Supabase SSR client: https://supabase.com/docs/guides/auth/server-side/creating-a-client
- Supabase migrate auth-helpers -> ssr: https://supabase.com/docs/guides/troubleshooting/how-to-migrate-from-supabase-auth-helpers-to-ssr-package-5NRunM
- Vercel Next.js: https://vercel.com/docs/frameworks/full-stack/nextjs

---

### 8.2 Session Retrieval (Server)
- `lib/supabase/server.ts`: createServerClient memakai cookies.
- `lib/supabase/auth.ts`: helper `getSession()` + `getProfile()`.

### 8.3 Proxy/BFF Route Handlers
Route Handlers di App Router adalah mekanisme resmi untuk custom request handlers di `app/`.  

**Klasifikasi endpoint**
- `/api/leads/*`:
  - create lead
  - update lead
  - assign handover
  - create lead + optional auto RFQ
- `/api/tickets/*`:
  - create ticket
  - post message
  - close/cancel
- `/api/imports/*`:
  - upload file record
  - parse CSV/Excel (di server)
  - insert import_rows
- `/api/invoices/*`:
  - create invoice
  - record payment
- `/api/kpi/*`:
  - set targets
  - submit evidence
  - ingest manual metrics

**No service role key di client.**
- Route handler pakai server client (cookie session).
- Semua enforcement tetap lewat RLS.

### 8.4 Authorization Enforcement
Layering:
1) **RLS** (source of truth).
2) Proxy guard: block request cepat kalau role tidak eligible.
3) UI hide: sidebar/pages yang tidak eligible tidak muncul.

---

## 9. Data Model Overview (Entities + Ownership)

### 9.1 Entities (Minimum)
- Access control: `roles`, `departments`, `profiles`
- Core CRM: `customers`, `leads`, `prospects`, `prospect_stage_history`, `sales_activities`
- Ticketing: `tickets`, `ticket_messages`, `ticket_attachments`, `sla_events`
- KPI engine: `kpi_metric_definitions`, `kpi_targets`, plus reporting views
- Manual input: `marketing_activity_events`, `marketing_spend`, `imports`, `import_rows`
- DSO/AR: `invoices`, `payments`, reporting views `v_invoice_outstanding`, `v_ar_aging`, `v_dso_rolling_30`
- Productivity: `saved_views`
- Governance: `audit_logs`
- Master: `service_catalog`

### 9.2 Ownership Scopes (Canonical)
- Lead ownership:
  - `created_by` always set.
  - `sales_owner_user_id` nullable sampai handover.
- Prospect ownership:
  - `owner_user_id` wajib.
- Customer Ã¢â‚¬Å“ownershipÃ¢â‚¬Â tidak disimpan sebagai kolom khusus (agar tidak menambah schema di luar minimum).
  - Scoped via `leads.customer_id` + ownership rules.
- Ticket access:
  - creator/assignee + dept_target.
- DSO scoping:
  - finance full.
  - sales via customer ownership derived from leads.

---

## 10. End-to-End Flows (No Double Entry)

### 10.1 Lead Ã¢â€ â€™ Customer + Prospect (Auto-link)
Trigger via BFF:
- Insert lead:
  - dedup customer by **NPWP/email/phone/company** (sesuai schema + function dedup in schema.sql).
  - jika customer belum ada Ã¢â€ â€™ create.
  - jika prospect belum ada untuk customer + owner Ã¢â€ â€™ create.

Output:
- `lead_id`, `customer_id`, `prospect_id`.

### 10.2 Lead Ã¢â€ â€™ Optional RFQ (Auto-create Ticket Inquiry)
Gating:
- User toggle **Need rate quote**.
- Field RFQ minimum lengkap:
  - dept_target
  - service
  - origin/destination addresses & city/country
  - cargo basics (kategori barang, qty, dimensi, weight)
  - scope of work
Jika belum lengkap Ã¢â€ â€™ RFQ tidak dibuat.

Jika dibuat:
- insert `tickets`:
  - `ticket_type = inquiry tariff`
  - `need_customer_masking = true`
  - `related_lead_id` set
  - `related_customer_id` set
- Ops melihat via `v_ops_rfqs_masked` (company_name = MASKED).

### 10.3 Ticket Lifecycle (4 types)
- inquiry tariff: OPEN Ã¢â€ â€™ WAITING RESPON (IN PROGRESS) Ã¢â€ â€™ WAITING CUSTOMER (IN PROGRESS) Ã¢â€ â€™ CLOSED
  - CLOSED LOST wajib reason (PRICE tidak kompetitif/terlalu mahal + opsi tarif kompetitor/budget customer).
- general request / request pickup / request delivery:
  - OPEN Ã¢â€ â€™ IN PROGRESS Ã¢â€ â€™ CLOSED

### 10.4 Invoice Ã¢â€ â€™ Payment Ã¢â€ â€™ AR Aging Ã¢â€ â€™ DSO
- Finance create invoice + due date.
- Finance record payments.
- Views compute:
  - outstanding, overdue, aging buckets
  - rolling DSO.

---

## 11. KPI Engine Design (Canonical, Auto/Manual/Imported)

### 11.1 Prinsip Umum
- **AUTO**: dihitung dari data internal (leads, prospects, invoices, tickets, activities).
- **MANUAL**: diinput via form (tanpa API eksternal).
- **IMPORTED**: upload Excel/CSV Ã¢â€ â€™ tabel internal Ã¢â€ â€™ dihitung otomatis.
- Semua KPI punya:
  - `metric_key` (immutable)
  - owner role
  - unit
  - direction (higher/lower better)
  - periodization (daily/weekly/monthly)
- Target disimpan di `kpi_targets`. Realisasi via views/agregasi.

### 11.2 KPI Sales (AUTO)
- `SALES_REVENUE`: ÃŽÂ£ invoices.invoice_amount (invoice_date).
- `SALES_NEW_LOGOS`: first invoice per customer (Ã¢â€°Â¤3 bulan).
- `SALES_ACTIVE_CUSTOMERS`: distinct customer bertransaksi di periode.
- `SALES_RETENTION_RATE`: aktif_t Ã¢Ë†Â© aktif_t-1 / aktif_t-1.
- `SALES_CHURN_RATE`: 1 Ã¢Ë†â€™ retention.
- `SALES_WIN_RATE`: **NA** (butuh deal table; declared gap).
- `SALES_CYCLE_DAYS`: **NA** (butuh qualified/close date).
- `SALES_RESPONSE_TIME_MEDIAN`: median first response inquiry (view).
- `SALES_DSO_DAYS`: rolling DSO dari views.
- `SALES_ACTIVITY_COUNT`: visit/call/meeting/email/wa (valid jika evidence minimal).

### 11.3 KPI Marketing (AUTO + MANUAL/IMPORTED)
**Marcomm**
- `MKT_LEADS_BY_CHANNEL` (AUTO).
- `MKT_REVENUE_ATTRIBUTED` (AUTO; leadÃ¢â€ â€™customerÃ¢â€ â€™invoice).
- `MARCOMM_SEM_SPEND` (IMPORTED).
- `MARCOMM_SEM_CPL` (AUTO).
- `MARCOMM_ROAS` (AUTO; revenue/spend, asumsi last-touch lead attribution).

**DGO**
- `DGO_SOCIAL_LEADS` (AUTO).
- `DGO_PAID_SOCIAL_SPEND` (IMPORTED).
- `DGO_PAID_SOCIAL_CPL` (AUTO).
- `DGO_ROAS` (AUTO).
- Reach/Engagement: **MANUAL metric input** (no API).

**MACX**
- `MACX_ATTRIBUTION_COMPLETENESS_PCT` (AUTO).
- `MACX_REPORT_FRESHNESS_SLA_PCT` (AUTO dari report logs).
- VOC/CSAT/NPS coverage: MANUAL/IMPORTED.

**VSDO**
- `VSDO_ON_TIME_DELIVERY_PCT` (IMPORTED).
- `VSDO_MEDIAN_TAT` (IMPORTED).
- `VSDO_FIRST_PASS_APPROVAL_PCT` (IMPORTED).

---

## 12. Manual Input Tools (No External Integration)

### 12.1 UI Tools
- **Activity & Spend Input**:
  - Form single-entry.
  - Bulk import Excel/CSV.
- **Import Center**:
  - Upload file Ã¢â€ â€™ parse server Ã¢â€ â€™ validate Ã¢â€ â€™ write `import_rows`.
  - Error rows tersimpan dengan pesan validasi.

### 12.2 Audit Trail
- Semua insert/update manual dicatat di `audit_logs`:
  - who, when, table, before/after (jsonb).

---

## 13. Ticketing Design (Detail)

### 13.1 SLA & Response Time
- `sla_events` mencatat:
  - opened_at
  - first_response_at
  - status_changes
- View `v_ticket_first_response(_median)` jadi sumber KPI.

### 13.2 Masking Strategy (Ops)
- RFQ dari lead:
  - `need_customer_masking = true`.
  - Ops baca via `v_ops_rfqs_masked`.
  - Field PII = `MASKED`.

---

## 14. DSO / AR Design (Per Role)

### 14.1 Finance
- CRUD invoices & payments.
- Aging buckets + trend.
- Rolling DSO.

### 14.2 Sales Manager / Salesperson
- Read-only:
  - Ã¢â‚¬Å“My Customers ARÃ¢â‚¬Â.
  - Scoped by ownership via RLS.

---

## 15. RLS & Security Summary

### 15.1 Principles
- Default deny.
- Policy per table pakai `auth.uid()` + join `profiles.role_name`.
- Director: read-only.
- super admin: full.
- Ops: dept-scoped + masked views.

### 15.2 Storage Buckets
- `ticket-attachments`
- `kpi-evidence`
- `prospect-evidence`
- `customer-documents`
- `import-files`
Policies selaras RLS tabel induk.

---

## 16. Performance & Indexing
- Index:
  - `leads(lead_date, primary_channel, sales_owner_user_id)`
  - `tickets(ticket_type, dept_target, created_at)`
  - `invoices(customer_id, invoice_date, due_date)`
  - `payments(invoice_id, payment_date)`
- Pagination wajib di list besar.

---

## 17. Deprecation Audit (Official)
- Next Route Handlers & route.ts file convention.  
- Supabase SSR (`@supabase/ssr`) + migrasi dari auth-helpers.  
- Vercel Next.js deployment.

---

## 18. GRAND PLAN: 11 STEP (STEP 0Ã¢â‚¬â€œ10)
Tidak disertakan di file ini pada deliverable chat sebelumnya (gap). NA.

---

## 19. Output Validator (PASS)
Mengacu ke `docs/validator.json`.

---

## 20. Open Inputs (Minimal, Declared)
- Sales Win Rate & Sales Cycle Length: **NA** (butuh deal/qualified/close date table).
- Lead scoring rules: **NA** (tidak didefinisikan eksplisit).

END OF BLUEPRINT.
