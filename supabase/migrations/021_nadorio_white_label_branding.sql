-- NADORIO 12.1: expose only the approved public-facing branding fields.
-- This replaces the narrow branding projection; it does not expose clubs.*.
drop function if exists public.v11_public_branding(uuid);
create function public.v11_public_branding(target_club uuid)
returns table(
  name text,
  logo_url text,
  primary_color text,
  secondary_color text,
  background_color text,
  surface_color text,
  text_color text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.name,
    c.logo_url,
    c.primary_color,
    c.secondary_color,
    c.background_color,
    c.surface_color,
    c.text_color
  from public.clubs c
  join public.organization_sites s on s.club_id = c.id
  where c.id = target_club
    and s.published
    and public.v11_site_live(c.id);
$$;
grant execute on function public.v11_public_branding(uuid) to anon, authenticated;
