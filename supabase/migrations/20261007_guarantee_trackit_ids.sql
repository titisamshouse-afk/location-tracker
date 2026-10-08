-- Guarantee every Trackit account receives a permanent unique 8-character ID.
create unique index if not exists accounts_trackit_id_unique
on public.accounts(trackit_id)
where trackit_id is not null and btrim(trackit_id) <> '';

create or replace function public.ensure_account_trackit_id()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  v_id text;
begin
  if new.trackit_id is null or btrim(new.trackit_id) = '' then
    loop
      v_id := upper(substr(encode(gen_random_bytes(8),'hex'),1,8));
      exit when not exists (select 1 from public.accounts where trackit_id=v_id);
    end loop;
    new.trackit_id := v_id;
  end if;
  return new;
end;
$function$;

drop trigger if exists accounts_ensure_trackit_id on public.accounts;
create trigger accounts_ensure_trackit_id
before insert on public.accounts
for each row execute function public.ensure_account_trackit_id();

revoke execute on function public.ensure_account_trackit_id() from public, anon, authenticated;

create or replace function public.create_account(p_username text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  v_account accounts;
  v_token text;
  v_trackit_id text;
begin
  if length(trim(p_username)) < 3 or length(trim(p_username)) > 32 then
    raise exception 'Username must be 3-32 characters';
  end if;
  if p_username !~ '^[A-Za-z0-9_]+$' then
    raise exception 'Username may only contain letters, numbers, and underscores';
  end if;
  if length(p_password) < 8 then
    raise exception 'Password must be at least 8 characters';
  end if;
  if exists (select 1 from accounts where lower(username)=lower(trim(p_username))) then
    raise exception 'Username already exists';
  end if;

  loop
    v_trackit_id := upper(substr(encode(gen_random_bytes(8),'hex'),1,8));
    exit when not exists (select 1 from accounts where trackit_id=v_trackit_id);
  end loop;

  insert into accounts(username, password_hash, trackit_id)
  values (trim(p_username), crypt(p_password, gen_salt('bf', 12)), v_trackit_id)
  returning * into v_account;

  v_token := encode(gen_random_bytes(32), 'hex');
  insert into sessions(account_id, token_hash, expires_at)
  values (v_account.id, encode(digest(v_token, 'sha256'), 'hex'), now() + interval '30 days');

  return jsonb_build_object('token', v_token, 'account_id', v_account.id, 'username', v_account.username, 'trackit_id', v_account.trackit_id);
end;
$function$;
