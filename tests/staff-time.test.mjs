import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const migration = readFileSync("supabase/migrations/022_nadorio_staff_time_management.sql", "utf8");
const page = readFileSync("app/workspace/[id]/staff/page.tsx", "utf8");

test("staff timesheet RPC is organization-scoped and limits date ranges", () => {
  assert.match(migration, /where t\.club_id = p_club_id/);
  assert.match(migration, /p_end - p_start > 366/);
  assert.match(migration, /public\.v11_can_module\(p_club_id, 'staff', 'view'\)/);
  assert.match(migration, /p_all and not public\.v11_can_write\(p_club_id, 'staff', 'view'\)/);
});

test("manager time corrections require permission, reason, and optimistic concurrency", () => {
  assert.match(migration, /public\.v11_can_write\(p_club_id, 'staff', 'edit'\)/);
  assert.match(migration, /length\(trim\(coalesce\(p_reason, ''\)\)\) < 5/);
  assert.match(migration, /t\.updated_at is distinct from p_expected_updated_at/);
  assert.match(migration, /insert into public\.audit_log/);
  assert.match(migration, /tips = p_tips/);
  assert.match(migration, /This correction overlaps another shift/);
});

test("staff UI uses protected timesheet RPC and offers corrections and CSV export", () => {
  assert.match(page, /rpc\("v12_staff_timesheet"/);
  assert.match(page, /rpc\("v12_correct_staff_time"/);
  assert.match(page, /Download CSV/);
  assert.match(page, /Reason for correction/);
  assert.ok(existsSync("supabase/migrations/022_nadorio_staff_time_management.sql"));
});
