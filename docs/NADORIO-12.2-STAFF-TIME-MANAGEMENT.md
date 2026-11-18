# NADORIO 12.2 — staff time management

This release extends the existing NADORIO `staff_time_entries` table. It does not import LINDEX's separate staff schema or any Linderhof data.

## Included

- Organization-scoped date-range timesheets using the organization's configured timezone.
- Staff can see their own shifts; users with the Staff module's view permission can review the organization's timesheets.
- Staff can enter optional shift tips when clocking out. Blank means not reported; zero means no tips.
- Users with the Staff module's edit permission can correct shift times and tips.
- Corrections require a reason, reject overlapping shifts, use an `updated_at` concurrency check, and write before/after details to `audit_log`.
- CSV export is generated in the browser and protects spreadsheet cells from formula injection.

## Migration

Apply `supabase/migrations/022_nadorio_staff_time_management.sql` only after migrations 001–021 have been applied. Back up the database and apply to staging first. The migration is additive and preserves the existing `tips` column and all existing shift records.

## Verification checklist

1. A staff member clocks in and clocks out; the server/database clock supplies the recorded timestamps.
2. A staff member can read their own shifts but cannot request another staff member's timesheet.
3. A manager with Staff `view` permission can view organization timesheets; without it, the RPC denies the request.
4. A manager with Staff `edit` permission can correct a shift only with a reason of at least five characters.
5. A correction with a stale `updated_at`, invalid time, or overlapping shift is rejected.
6. The audit log contains the actor, organization, reason, and before/after values.
7. A user from another organization cannot read or correct this organization's records.
8. CSV export includes only the selected date range and neutralizes spreadsheet formula prefixes.

## Notes / not yet included

- This phase does not add break tracking, scheduled shifts, payroll-provider integration, or Excel workbook export.
- The automated Node tests verify the application contract and migration guardrails. A live Supabase staging test is still required before production deployment.
- The current local runtime is Node 22, while this repository specifies Node 24. Run `npm ci`, `npm run typecheck`, and `npm run build` under Node 24 before release.
