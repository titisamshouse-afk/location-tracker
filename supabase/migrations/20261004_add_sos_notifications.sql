create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  expo_push_token text not null unique,
  platform text not null,
  updated_at timestamptz not null default now()
);
create index if not exists push_tokens_account_id_idx on public.push_tokens(account_id);
create table if not exists public.sos_events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  latitude double precision,
  longitude double precision,
  accuracy double precision,
  created_at timestamptz not null default now()
);
create index if not exists sos_events_account_created_idx on public.sos_events(account_id,created_at desc);
alter table public.push_tokens enable row level security;
alter table public.sos_events enable row level security;

create or replace function public.register_push_token(p_token text,p_expo_push_token text,p_platform text)
returns jsonb language plpgsql security definer set search_path to 'public','extensions' as $$
declare v_account_id uuid;
begin
 select account_id into v_account_id from public.sessions where token_hash=encode(digest(p_token,'sha256'),'hex') and expires_at>now() limit 1;
 if v_account_id is null then raise exception 'Session expired or invalid'; end if;
 if p_expo_push_token is null or length(trim(p_expo_push_token))<10 then raise exception 'Invalid push token'; end if;
 insert into public.push_tokens(account_id,expo_push_token,platform,updated_at) values(v_account_id,trim(p_expo_push_token),coalesce(p_platform,'unknown'),now())
 on conflict(expo_push_token) do update set account_id=excluded.account_id,platform=excluded.platform,updated_at=now();
 return jsonb_build_object('success',true);
end; $$;

create or replace function public.create_sos_event(p_token text,p_latitude double precision default null,p_longitude double precision default null,p_accuracy double precision default null)
returns jsonb language plpgsql security definer set search_path to 'public','extensions' as $$
declare v_account_id uuid; v_event_id uuid;
begin
 select account_id into v_account_id from public.sessions where token_hash=encode(digest(p_token,'sha256'),'hex') and expires_at>now() limit 1;
 if v_account_id is null then raise exception 'Session expired or invalid'; end if;
 if exists(select 1 from public.sos_events where account_id=v_account_id and created_at>now()-interval '60 seconds') then raise exception 'Please wait 60 seconds before sending another SOS'; end if;
 insert into public.sos_events(account_id,latitude,longitude,accuracy) values(v_account_id,p_latitude,p_longitude,p_accuracy) returning id into v_event_id;
 return jsonb_build_object('success',true,'event_id',v_event_id);
end; $$;
revoke all on function public.register_push_token(text,text,text) from public;
revoke all on function public.create_sos_event(text,double precision,double precision,double precision) from public;
grant execute on function public.register_push_token(text,text,text) to anon,authenticated;
grant execute on function public.create_sos_event(text,double precision,double precision,double precision) to anon,authenticated;