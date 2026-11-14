-- Run this entire script in Supabase Dashboard > SQL Editor.
create table if not exists public.potionz_keys (
  key_hash text primary key,
  created_at timestamptz not null default now(),
  created_by text not null,
  redeemed_at timestamptz,
  redeemed_session_hash text
);

create table if not exists public.potionz_sessions (
  token_hash text primary key,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table public.potionz_keys enable row level security;
alter table public.potionz_sessions enable row level security;

-- Only the server's service-role key accesses these tables. Never put that key in browser code.
revoke all on public.potionz_keys from anon, authenticated;
revoke all on public.potionz_sessions from anon, authenticated;
grant all on public.potionz_keys to service_role;
grant all on public.potionz_sessions to service_role;

create or replace function public.potionz_redeem_key(
  p_key_hash text,
  p_session_hash text,
  p_session_days integer default 30
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.potionz_keys
     set redeemed_at = now(), redeemed_session_hash = p_session_hash
   where key_hash = p_key_hash and redeemed_at is null;
  if not found then
    return false;
  end if;
  insert into public.potionz_sessions(token_hash, expires_at)
  values (p_session_hash, now() + make_interval(days => greatest(1, least(p_session_days, 90))));
  return true;
end;
$$;
revoke all on function public.potionz_redeem_key(text, text, integer) from public, anon, authenticated;
grant execute on function public.potionz_redeem_key(text, text, integer) to service_role;
