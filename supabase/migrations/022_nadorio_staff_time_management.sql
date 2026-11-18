-- NADORIO 12.2: staff timesheets, tips, and audited manager corrections.
-- Additive migration. All reads and writes remain scoped to the active organization.
begin;

alter table public.staff_time_entries
  add column if not exists updated_at timestamptz not null default now();

-- Existing NADORIO records use `tips`; preserve that column and its data.
alter table public.staff_time_entries
  add constraint staff_time_tips_valid
  check (tips is null or (tips >= 0 and tips <= 999999.99 and tips = round(tips, 2)))
  not valid;
alter table public.staff_time_entries validate constraint staff_time_tips_valid;

create or replace function public.v11_time_guard() returns trigger
language plpgsql security definer set search_path=public as $$
declare admin_edit boolean := coalesce(current_setting('nadorio.staff_time_admin_edit', true), '') = 'on';
begin
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(hashtext(new.club_id::text || new.user_id::text));
    if exists (
      select 1 from public.staff_time_entries
      where club_id = new.club_id and user_id = new.user_id and clock_out is null
    ) then raise exception 'A shift is already open'; end if;
    new.clock_in := now();
    new.clock_out := null;
    new.updated_at := now();
    return new;
  end if;

  if admin_edit and public.v11_can_write(old.club_id, 'staff', 'edit') then
    if new.club_id is distinct from old.club_id or new.user_id is distinct from old.user_id then
      raise exception 'Organization and staff identity cannot be changed';
    end if;
    if new.clock_in is null or new.clock_in > now() or (new.clock_out is not null and (new.clock_out < new.clock_in or new.clock_out > now())) then
      raise exception 'Choose valid past shift times';
    end if;
    new.updated_at := now();
    return new;
  end if;

  if old.clock_out is not null
    or auth.uid() is distinct from old.user_id
    or (to_jsonb(new) - array['clock_out','tips','updated_at']) is distinct from (to_jsonb(old) - array['clock_out','tips','updated_at'])
  then raise exception 'Only your open shift can be clocked out'; end if;

  new.clock_out := now();
  new.updated_at := now();
  return new;
end $$;

create or replace function public.v12_staff_timesheet(
  p_club_id uuid,
  p_start date,
  p_end date,
  p_all boolean default false
) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare tz text; lo timestamptz; hi timestamptz;
begin
  if auth.uid() is null or not public.v11_can_module(p_club_id, 'staff', 'view') then
    raise exception 'Staff module access denied';
  end if;
  if p_start is null or p_end is null or p_end < p_start or p_end - p_start > 366 then
    raise exception 'Choose a date range of up to 367 days';
  end if;
  if p_all and not public.v11_can_write(p_club_id, 'staff', 'view') then
    raise exception 'You are not allowed to view all staff timesheets';
  end if;
  select timezone into tz from public.clubs where id = p_club_id;
  if tz is null then raise exception 'Organization not found'; end if;
  lo := p_start::timestamp at time zone tz;
  hi := (p_end + 1)::timestamp at time zone tz;
  return (
    select coalesce(jsonb_agg(to_jsonb(x) order by x.clock_in desc), '[]'::jsonb)
    from (
      select t.id, t.club_id, t.user_id, p.full_name, t.clock_in, t.clock_out,
        t.updated_at, t.tips,
        case when t.clock_in >= lo and t.clock_in < hi then t.tips else null end as tips_in_period,
        greatest(0, extract(epoch from least(coalesce(t.clock_out, now()), hi) - greatest(t.clock_in, lo))) as period_seconds
      from public.staff_time_entries t
      left join public.profiles p on p.id = t.user_id
      where t.club_id = p_club_id
        and (not p_all and t.user_id = auth.uid() or p_all)
        and t.clock_in < hi and coalesce(t.clock_out, now()) >= lo
    ) x
  );
end $$;

create or replace function public.v12_correct_staff_time(
  p_club_id uuid,
  p_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_expected_updated_at timestamptz,
  p_tips numeric,
  p_reason text
) returns void
language plpgsql security definer set search_path=public as $$
declare t public.staff_time_entries%rowtype;
begin
  if auth.uid() is null or not public.v11_can_write(p_club_id, 'staff', 'edit') then
    raise exception 'Staff time-edit permission required';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'A correction reason of at least five characters is required'; end if;
  if p_start is null or p_start > now() or (p_end is not null and (p_end < p_start or p_end > now())) then
    raise exception 'Choose valid past shift times';
  end if;
  if p_tips is not null and not (p_tips >= 0 and p_tips <= 999999.99 and p_tips = round(p_tips, 2)) then
    raise exception 'Tips must be between $0 and $999,999.99 with at most two decimal places';
  end if;

  select * into t from public.staff_time_entries
  where id = p_id and club_id = p_club_id for update;
  if not found then raise exception 'Shift not found in this organization'; end if;
  if t.updated_at is distinct from p_expected_updated_at then raise exception 'This shift changed. Refresh before correcting it.'; end if;
  if exists (
    select 1 from public.staff_time_entries e
    where e.club_id = p_club_id and e.user_id = t.user_id and e.id <> t.id
      and e.clock_in < coalesce(p_end, 'infinity'::timestamptz)
      and coalesce(e.clock_out, 'infinity'::timestamptz) > p_start
  ) then raise exception 'This correction overlaps another shift'; end if;

  perform set_config('nadorio.staff_time_admin_edit', 'on', true);
  update public.staff_time_entries
    set clock_in = p_start, clock_out = p_end, tips = p_tips, updated_at = now()
    where id = t.id and club_id = p_club_id;

  insert into public.audit_log(club_id, actor_id, action, target_type, target_id, detail)
  values (
    p_club_id, auth.uid(), 'staff_time_corrected', 'staff_time_entries', t.id::text,
    jsonb_build_object('reason', trim(p_reason), 'before', to_jsonb(t),
      'after', jsonb_build_object('clock_in', p_start, 'clock_out', p_end, 'tips', p_tips))
  );
end $$;

revoke all on function public.v12_staff_timesheet(uuid,date,date,boolean) from public, anon;
revoke all on function public.v12_correct_staff_time(uuid,uuid,timestamptz,timestamptz,timestamptz,numeric,text) from public, anon;
grant execute on function public.v12_staff_timesheet(uuid,date,date,boolean) to authenticated;
grant execute on function public.v12_correct_staff_time(uuid,uuid,timestamptz,timestamptz,timestamptz,numeric,text) to authenticated;

create index if not exists staff_time_club_user_clock on public.staff_time_entries(club_id, user_id, clock_in desc);
notify pgrst, 'reload schema';
commit;
