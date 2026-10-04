-- Show each friend once and keep the last known coordinates visible after sharing stops.
create or replace function public.list_friends(p_token text)
returns table(
  id uuid,
  username text,
  sharing boolean,
  latitude double precision,
  longitude double precision,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path to 'public','extensions'
as $function$
declare
  me uuid;
begin
  me := public.require_account(p_token);

  return query
  select distinct on (a.id)
    a.id,
    a.username,
    coalesce(l.is_sharing,false)
      and l.updated_at > now() - interval '60 seconds' as sharing,
    l.latitude,
    l.longitude,
    l.updated_at
  from public.location_shares s
  join public.accounts a
    on a.id = case when s.owner_id=me then s.viewer_id else s.owner_id end
  left join public.locations l
    on l.user_id=a.id
  where (s.owner_id=me or s.viewer_id=me)
    and s.status='active'
  order by a.id, lower(a.username);
end;
$function$;
