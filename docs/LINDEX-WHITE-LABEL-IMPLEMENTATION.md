# LINDEX-inspired white-label organization experience

## Product direction

NADORIO is the reusable multi-organization product. LINDEX is the design and workflow reference: premium club presentation, clear member/staff/admin navigation, welcoming dashboard surfaces, and consistent mobile behavior. LINDEX-specific identity, member records, and operational data are not copied into another organization's tenant.

## Organization-owned appearance

Each organization controls its own fields on `public.clubs`:

- `name` and `logo_url`
- `primary_color` and `secondary_color`
- `background_color`, `surface_color`, and `text_color`
- `portal_title` and `welcome_message`
- `website_url`, `contact_email`, and `organization_type`

The organization workspace converts those values into CSS custom properties through `lib/organization-theme.ts`. The LINDEX-inspired palette is only the fallback for organizations that have not selected a brand. A valid organization color overrides the fallback for that organization only.

The organization settings page supports logo upload, name and public contact details, five color controls with a live preview, licensed module enablement, member visibility, and custom navigation labels. Navigation label edits are saved to the existing `club_modules.nav_label` field; no schema change is required for that field.

## Tenant boundaries

- Organization identity is loaded from the active workspace selected by the route and verified through `loadWorkspaceAccess`.
- The existing access context, role checks, module licensing, and route authorization remain authoritative.
- The branding editor updates only the current `clubs` row and its own `club_modules` rows.
- The public website uses the approved public branding projection; it does not receive the full `clubs` record.
- Do not remove or weaken Supabase row-level security or the existing `club_id` filters when adding new features.

## Existing additive migrations

Apply the migrations in order using the project's existing Supabase deployment process:

- `021_nadorio_white_label_branding.sql` updates the approved public branding RPC to return the public theme fields.
- `022_nadorio_staff_time_management.sql` adds staff timesheet reporting, tips validation, and audited manager corrections.

The five organization color columns and the `club_modules.nav_label` field already exist in earlier migrations in this repository. The LINDEX-inspired CSS/theme refresh itself does not require a new database migration.

## Validation

Run:

```bash
npm ci
npm run typecheck
npm test
npm run build
```

The automated Node tests can also be run with:

```bash
node --experimental-strip-types --test tests/*.test.mjs
```

The development container used for this build had Node 22, while this repository specifies Node 24. Dependency installation did not complete in that environment, so a full Next.js typecheck and production build must still be run under Node 24 before deployment.
