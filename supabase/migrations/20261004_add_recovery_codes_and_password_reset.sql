alter table public.accounts
  add column if not exists recovery_code_hash text;

create or replace function public.generate_recovery_code(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $function$
declare v_account_id uuid; v_code text;
begin
  select account_id into v_account_id from public.sessions
  where token_hash=encode(digest(p_token,'sha256'),'hex') and expires_at>now() limit 1;
  if v_account_id is null then raise exception 'Session expired or invalid'; end if;
  v_code:=upper(encode(gen_random_bytes(8),'hex'));
  update public.accounts set recovery_code_hash=crypt(v_code,gen_salt('bf',12)) where id=v_account_id;
  return jsonb_build_object('success',true,'recovery_code',v_code);
end;
$function$;

create or replace function public.reset_password_with_recovery(p_username text,p_recovery_code text,p_new_password text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $function$
declare v_account_id uuid;
begin
  if length(p_new_password)<8 then raise exception 'Password must be at least 8 characters'; end if;
  select id into v_account_id from public.accounts
  where lower(username)=lower(trim(p_username))
    and recovery_code_hash is not null
    and recovery_code_hash=crypt(trim(p_recovery_code),recovery_code_hash) limit 1;
  if v_account_id is null then raise exception 'Invalid username or recovery code'; end if;
  update public.accounts set password_hash=crypt(p_new_password,gen_salt('bf',12)),recovery_code_hash=null where id=v_account_id;
  delete from public.sessions where account_id=v_account_id;
  return jsonb_build_object('success',true);
end;
$function$;

revoke all on function public.generate_recovery_code(text) from public;
revoke all on function public.reset_password_with_recovery(text,text,text) from public;
grant execute on function public.generate_recovery_code(text) to anon,authenticated;
grant execute on function public.reset_password_with_recovery(text,text,text) to anon,authenticated;