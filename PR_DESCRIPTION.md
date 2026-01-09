# PR: feat(kpi,crm): KPI actuals tracking and CRM dedup preflight

**Branch**: `claude/kpi-crm-remediation-v1-68zJh`
**Base**: `main`

---

## Summary

### KPI Improvements
- **kpi_actuals table**: New table for storing manual KPI progress values per metric/period/user with unique constraint
- **kpi_update_manual_progress RPC**: Atomic upsert function (SECURITY DEFINER) for safe progress updates
- **kpi_get_auto_value function**: Returns calculated values from internal views for AUTO metrics (sales revenue, activities, leads, DSO, etc.)
- **v_kpi_progress view**: Combines manual actuals with auto-calculated values for unified progress display
- **/api/kpi/progress route**: New API endpoint for GET/POST KPI progress via RPC
- **/kpi/progress page**: New UI for manual KPI input with per-metric save functionality
- **My KPI page update**: Removed SAMPLE_ACHIEVEMENTS dummy data, now uses real progress data
- **KPI Dashboard update**: Added "Update Progress" button linking to progress page

### CRM Improvements
- **/api/leads/stats route**: New endpoint for pipeline summary with role-scoped access (salesperson sees own, managers see all)
- **crm_get_pipeline_stats RPC**: Database function for efficient pipeline aggregation
- **/api/leads/dedup route**: New endpoint for duplicate checking by email/phone before lead creation
- **crm_check_duplicate RPC**: Database function for matching leads and customers
- **Create Lead page update**: Added dedup check modal with match preview and "Create Anyway" option

## SQL Migration File

`supabase/migrations/06_kpi_crm_remediation.sql`

**Must run in Supabase after PR merge.**

### Database Objects Created:
- Table: `public.kpi_actuals`
- RPC: `public.kpi_update_manual_progress()`
- RPC: `public.kpi_get_auto_value()`
- RPC: `public.crm_get_pipeline_stats()`
- RPC: `public.crm_check_duplicate()`
- View: `public.v_kpi_progress`
- View: `public.v_leads_pipeline_stats`
- RLS policies for `kpi_actuals`

## Verification Steps

### Build & Type Check
```bash
npm run build         # PASS ✓
npx tsc --noEmit      # PASS ✓
```

### KPI Manual Test Steps
1. Login as any user with KPI targets assigned
2. Navigate to `/kpi` - verify "Update Progress" button visible
3. Click "Update Progress" → navigate to `/kpi/progress`
4. Enter actual value for a MANUAL metric → click "Save"
5. Navigate to `/kpi/my` → verify progress shows real value (not dummy)
6. Confirm AUTO metrics display 0 or calculated values (no dummy data)

### CRM Manual Test Steps
1. Navigate to `/crm/leads/new`
2. Enter email/phone that exists in system
3. Click "Create Lead" → verify dedup modal appears with matches
4. Click "Cancel & Edit" → verify modal closes
5. Click "Create Anyway" → verify lead is created
6. Test `/api/leads/stats` endpoint → verify pipeline counts returned

## Risks & Rollback Plan

### Risks
- New RPC functions depend on existing views (`v_sales_revenue_daily`, etc.) - if views don't exist, auto-calc returns 0
- RLS policies on `kpi_actuals` may need adjustment for specific role requirements

### Rollback Steps
1. Revert this commit: `git revert <commit-hash>`
2. Drop database objects (if migration was applied):
```sql
DROP VIEW IF EXISTS public.v_kpi_progress;
DROP VIEW IF EXISTS public.v_leads_pipeline_stats;
DROP FUNCTION IF EXISTS public.kpi_update_manual_progress;
DROP FUNCTION IF EXISTS public.kpi_get_auto_value;
DROP FUNCTION IF EXISTS public.crm_get_pipeline_stats;
DROP FUNCTION IF EXISTS public.crm_check_duplicate;
DROP TABLE IF EXISTS public.kpi_actuals;
```

## Files Changed

### New Files
- `supabase/migrations/06_kpi_crm_remediation.sql` - Database migration
- `app/api/kpi/progress/route.ts` - KPI progress API
- `app/api/leads/stats/route.ts` - Leads stats API
- `app/api/leads/dedup/route.ts` - Leads dedup API
- `app/(protected)/kpi/progress/page.tsx` - KPI progress input page

### Modified Files
- `app/(protected)/kpi/page.tsx` - Added Update Progress button
- `app/(protected)/kpi/my/page.tsx` - Removed SAMPLE_ACHIEVEMENTS, use real data
- `app/(protected)/crm/leads/new/page.tsx` - Added dedup check modal
- `lib/api/client.ts` - Added helper functions for new APIs
