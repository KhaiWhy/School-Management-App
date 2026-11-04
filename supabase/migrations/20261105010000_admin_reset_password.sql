-- Phase 2: the admin can reset anyone's password from /admin → People, without email.
-- The page makes a one-time password and sends it here with the passkey; the person signs in
-- with it and changes it on their Profile. Their other sign-ins are ended, and any
-- wrong-password lock on their username is cleared. Safe to run again.

create or replace function public.admin_reset_password(passkey text, target uuid, new_password text)
returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  status text := public.admin_check(passkey);
  uname text;
begin
  if status <> 'ok' then
    return status;
  end if;
  if length(coalesce(new_password, '')) < 8 then
    return 'weak';
  end if;
  update auth.users
     set encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
         updated_at = now()
   where id = target;
  if not found then
    return 'not-found';
  end if;
  -- Sign them out everywhere (refresh tokens go with their sessions).
  if to_regclass('auth.sessions') is not null then
    execute 'delete from auth.sessions where user_id = $1' using target;
  end if;
  select username into uname from public.profiles where id = target;
  delete from public.sign_in_attempts where username = lower(uname);
  return 'ok';
end;
$$;

revoke execute on function public.admin_reset_password(text, uuid, text) from public;
grant execute on function public.admin_reset_password(text, uuid, text) to anon, authenticated;
