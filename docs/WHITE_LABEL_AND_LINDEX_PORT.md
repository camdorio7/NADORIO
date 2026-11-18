# NADORIO white-label foundation and LINDEX port

## Direction

NADORIO remains the multi-organization application and system of record. LINDEX is the functional reference for club workflows, not a second application to deploy for each customer. LINDEX is built on React 18/Vite while NADORIO is Next.js/React 19/TypeScript, so its components should be reimplemented in NADORIO's architecture rather than copied wholesale.

## White-label foundation in this release

- Organization brand settings are read as a complete organization record, while the old `organizationTheme(primaryColor)` call remains supported.
- Primary, secondary/accent, background, surface, and text colors are applied as CSS custom properties in the authenticated workspace.
- Organization settings now expose all five color controls and persist the values on the existing `clubs` record.
- Public organization sites receive a minimal public branding projection containing only the organization name, logo URL, and approved theme colors. They do not receive `clubs.*`.
- Public-site shell, header, feature panels, cards, contact area, and footer consume organization theme variables.
- Digital membership card selects the secondary color for future card accent styling.
- No new tenant tables or destructive data changes are required. Existing branding columns were introduced in earlier migrations; migration 021 expands only the public branding RPC projection.

## LINDEX functional reference map

| LINDEX source | NADORIO destination / approach |
|---|---|
| `MembershipAdmin.jsx` | `workspace/[id]/memberships`, `members`, `people`; compare workflows before replacing anything |
| `StaffWorkspace.jsx` | `workspace/[id]/staff` and `team-access` |
| `TimeClock.jsx` | `workspace/[id]/staff` / operations; port time-clock rules and reporting as a dedicated module |
| `Operations.jsx` | `workspace/[id]/operations` |
| `StaffExpenses.jsx` | operations / reports; identify whether a dedicated expenses module is needed |
| `MemberActivity.jsx` | member activity and audit history |
| `MemberExports.jsx` | `workspace/[id]/reports` and member export workflows |
| `AccountTools.jsx` | profile, member account, and access workflows |
| `ClubTools.jsx` | organization settings, amenities, and club administration |
| `OwnerRegistry.jsx` | platform-owner organization registry; preserve NADORIO's existing tenant controls |
| `SponsorAdmin.jsx` | likely new sponsorship module; confirm licensing and schema requirements before porting |
| `BarOrdering.jsx` | likely new food & beverage ordering module; isolate Square integration and order data by organization |
| `LPOADocuments.jsx` | documents module; make templates and records organization-scoped |
| `FinishTools.jsx` | map each tool individually to existing NADORIO modules before porting |
| `WeeklyHoursEmail.jsx`, `time-report.mjs`, `time-workbook.js` | staff scheduling/reporting and export workflows |
| `square-checkout.js`, `SquareEmbeddedCheckout.jsx` | NADORIO integrations and billing; do not reuse LINDEX credentials or payment configuration |
| `WorkspaceNavigation.jsx` | NADORIO's permission- and license-aware `navigationFor` system |

## Required safety rules for the port

1. Every record and storage object must be scoped to the authenticated organization (`club_id`).
2. Preserve NADORIO's RLS, module licensing, role permissions, audit trail, and platform-owner boundaries.
3. Do not import LINDEX production credentials, service-role keys, secrets, production data, or Linderhof member records.
4. Keep customer-facing text, logo, colors, domain, email sender, payment provider credentials, and feature availability organization-configurable.
5. Port workflows in small modules with tests. Do not merge the whole Vite application or its global CSS into the Next.js app.

## Next implementation milestones

1. Run a screen-by-screen workflow comparison for member, staff, operations, membership, and reporting tools.
2. Port the highest-value missing LINDEX workflows into NADORIO's TypeScript modules and existing routes.
3. Add configurable organization typography, favicon/app icon, email templates, and branded membership card assets.
4. Add onboarding validation and automated cross-tenant isolation tests for each new module.
5. Run typecheck, unit tests, database tests, browser tests, and a staging migration before production deployment.

## Deployment note

Apply `supabase/migrations/021_nadorio_white_label_branding.sql` through the normal migration process before expecting public websites to receive the expanded branding fields. Back up the database and test the migration in staging first.
