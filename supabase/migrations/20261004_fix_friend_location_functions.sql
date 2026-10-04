-- Location Tracker friend/location function fixes
-- Existing custom-token account model: accounts + sessions.

create or replace function public.require_account(p_token text)
returns uuid language plpgsql security definer set search_path to 'public','extensions'
as $function$
declare v_id uuid;
begin
  select account_id into v_id
  from public.sessions
  where token_hash=encode(digest(p_token,'sha256'),'hex')
    and expires_at > now()
  limit 1;
  if v_id is null then raise exception 'Invalid or expired session'; end if;
  return v_id;
end;
$function$;

create or replace function public.add_friend(p_token text,p_friend_username text)
returns json language plpgsql security definer set search_path to 'public','extensions'
as $function$
declare me uuid; other_id uuid; clean_username text;
begin
  me:=public.require_account(p_token);
  clean_username:=lower(trim(p_friend_username));
  select id into other_id from public.accounts where lower(username)=clean_username limit 1;
  if other_id is null then raise exception 'User not found'; end if;
  if other_id=me then raise exception 'You cannot add yourself'; end if;
  insert into public.location_shares(owner_id,viewer_id,status) values(me,other_id,'active')
    on conflict(owner_id,viewer_id) do update set status='active',updated_at=now();
  insert into public.location_shares(owner_id,viewer_id,status) values(other_id,me,'active')
    on conflict(owner_id,viewer_id) do update set status='active',updated_at=now();
  return json_build_object('success',true,'username',clean_username);
end;
$function$;

create or replace function public.list_friends(p_token text)
returns table(id uuid,username text,sharing boolean,latitude double precision,longitude double precision,updated_at timestamptz)
language plpgsql security definer set search_path to 'public','extensions'
as $function$
declare me uuid;
begin
  me:=public.require_account(p_token);
  return query
  select a.id,a.username,
    coalesce(l.is_sharing,false) and l.updated_at>now()-interval '60 seconds',
    case when coalesce(l.is_sharing,false) and l.updated_at>now()-interval '60 seconds' then l.latitude else null end,
    case when coalesce(l.is_sharing,false) and l.updated_at>now()-interval '60 seconds' then l.longitude else null end,
    l.updated_at
  from public.location_shares s
  join public.accounts a on a.id=case when s.owner_id=me then s.viewer_id else s.owner_id end
  left join public.locations l on l.user_id=a.id
  where (s.owner_id=me or s.viewer_id=me) and s.status='active'
  order by lower(a.username);
end;
$function$;

create or replace function public.remove_friend(p_token text,p_friend_id uuid)
returns json language plpgsql security definer set search_path to 'public','extensions'
as $function$
declare me uuid;
begin
  me:=public.require_account(p_token);
  delete from public.location_shares
  where (owner_id=me and viewer_id=p_friend_id) or (owner_id=p_friend_id and viewer_id=me);
  return json_build_object('success',true);
end;
$function$;

create or replace function public.stop_my_location(p_token text)
returns void language plpgsql security definer set search_path to 'public','extensions'
as $function$
declare v_account_id uuid;
begin
  select account_id into v_account_id
  from public.sessions
  where token_hash=encode(digest(p_token,'sha256'),'hex') and expires_at>now()
  limit 1;
  if v_account_id is null then raise exception 'Session expired or invalid'; end if;
  update public.locations set is_sharing=false,updated_at=now() where user_id=v_account_id;
end;
$function$;

create or replace function public.my_location_status(p_token text)
returns jsonb language sql security definer set search_path to 'public','extensions'
as $function$
  select coalesce(
    (
      select jsonb_build_object(
        'sharing',l.is_sharing and l.updated_at>now()-interval '60 seconds',
        'latitude',case when l.is_sharing and l.updated_at>now()-interval '60 seconds' then l.latitude else null end,
        'longitude',case when l.is_sharing and l.updated_at>now()-interval '60 seconds' then l.longitude else null end,
        'accuracy',case when l.is_sharing and l.updated_at>now()-interval '60 seconds' then l.accuracy_m else null end,
        'updated_at',l.updated_at
      )
      from public.sessions s join public.locations l on l.user_id=s.account_id
      where s.token_hash=encode(digest(p_token,'sha256'),'hex') and s.expires_at>now()
      limit 1
    ),
    jsonb_build_object('sharing',false)
  );
$function$;
