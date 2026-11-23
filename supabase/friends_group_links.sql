-- 友達機能の追加: グループ用の招待リンク（friends.sql のあとに、SQL Editorで1回実行。何度実行しても壊れません）
--   1人用: 1人だけ使えて、7日で切れる（これまでどおり）
--   グループ用: 最大5人まで使えて、3日で切れる。同時に2本まで。同じ人は、同じリンクを2回使えない
-- 実行前後でも、使い方は変わらない（2つの関数の呼び方は、これまでの呼び方でも動く）

alter table public.friend_invites add column if not exists max_uses integer not null default 1;
alter table public.friend_invites drop constraint if exists friend_invites_max_uses_chk;
alter table public.friend_invites add constraint friend_invites_max_uses_chk check (max_uses between 1 and 5);
alter table public.friend_invites add column if not exists use_count integer not null default 0;

-- グループ用リンクを使った人の記録（本人たちは、直接は読めない）
create table if not exists public.friend_invite_uses (
  token   text not null references public.friend_invites(token) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  used_at timestamptz not null default now(),
  acked   boolean not null default false,
  primary key (token, user_id)
);
alter table public.friend_invite_uses enable row level security;
revoke all on public.friend_invite_uses from anon, authenticated;
grant select, insert, update, delete on public.friend_invite_uses to service_role;

drop function if exists public.create_invite(text);
create or replace function public.create_invite(p_note text default null, p_max integer default 1)
returns table (token text, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); t text; ex timestamptz; nt text := nullif(btrim(coalesce(p_note, '')), ''); mx integer := coalesce(p_max, 1);
begin
  if uid is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from public.profiles where user_id = uid) then raise exception 'need_profile'; end if;
  if nt is not null and char_length(nt) > 12 then raise exception 'note_too_long'; end if;
  if mx < 1 or mx > 5 then raise exception 'bad_max'; end if;
  if public._friend_count(uid) >= 30 then raise exception 'friends_full'; end if;
  delete from public.friend_invites fi where fi.inviter = uid and fi.used_by is null and fi.use_count = 0 and fi.expires_at < now();
  if (select count(*) from public.friend_invites fi where fi.inviter = uid and fi.used_by is null and fi.use_count < fi.max_uses and fi.expires_at >= now()) >= 5 then raise exception 'too_many_invites'; end if;
  if mx > 1 and (select count(*) from public.friend_invites fi where fi.inviter = uid and fi.max_uses > 1 and fi.use_count < fi.max_uses and fi.expires_at >= now()) >= 2 then raise exception 'too_many_group_invites'; end if;
  t := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  insert into public.friend_invites (inviter, token, note, max_uses, expires_at)
    values (uid, t, nt, mx, now() + case when mx = 1 then interval '7 days' else interval '3 days' end)
    returning friend_invites.expires_at into ex;
  return query select t, ex;
end $$;
revoke all on function public.create_invite(text, integer) from public, anon;
grant execute on function public.create_invite(text, integer) to authenticated;

create or replace function public.peek_invite(p_token text)
returns table (status text, inviter_name text)
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); inv public.friend_invites; nm text;
begin
  if uid is null then raise exception 'not signed in'; end if;
  select * into inv from public.friend_invites where token = lower(btrim(p_token));
  if not found then return query select 'not_found'::text, null::text; return; end if;
  if (inv.max_uses = 1 and inv.used_by is not null) or inv.use_count >= inv.max_uses then return query select 'used'::text, null::text; return; end if;
  if inv.expires_at < now() then return query select 'expired'::text, null::text; return; end if;
  if inv.inviter = uid then return query select 'self'::text, null::text; return; end if;
  if public._blocked(inv.inviter, uid) then return query select 'unavailable'::text, null::text; return; end if;
  if exists (select 1 from public.friendships where user_a = least(uid, inv.inviter) and user_b = greatest(uid, inv.inviter))
     or exists (select 1 from public.friend_invite_uses u where u.token = inv.token and u.user_id = uid) then
    return query select 'already'::text, null::text; return;
  end if;
  select display_name into nm from public.profiles where user_id = inv.inviter;
  return query select 'ok'::text, coalesce(nm, '');
end $$;

create or replace function public.accept_invite(p_token text)
returns table (status text, friend_name text)
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); inv public.friend_invites; nm text;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from public.profiles where user_id = uid) then return query select 'need_profile'::text, null::text; return; end if;
  select * into inv from public.friend_invites where token = lower(btrim(p_token)) for update;
  if not found then return query select 'not_found'::text, null::text; return; end if;
  if (inv.max_uses = 1 and inv.used_by is not null) or inv.use_count >= inv.max_uses then return query select 'used'::text, null::text; return; end if;
  if inv.expires_at < now() then return query select 'expired'::text, null::text; return; end if;
  if inv.inviter = uid then return query select 'self'::text, null::text; return; end if;
  if public._blocked(inv.inviter, uid) then return query select 'unavailable'::text, null::text; return; end if;
  if exists (select 1 from public.friendships where user_a = least(uid, inv.inviter) and user_b = greatest(uid, inv.inviter))
     or exists (select 1 from public.friend_invite_uses u where u.token = inv.token and u.user_id = uid) then
    return query select 'already'::text, null::text; return;
  end if;
  if public._friend_count(uid) >= 30 then return query select 'my_full'::text, null::text; return; end if;
  if public._friend_count(inv.inviter) >= 30 then return query select 'their_full'::text, null::text; return; end if;
  insert into public.friendships (user_a, user_b) values (least(uid, inv.inviter), greatest(uid, inv.inviter));
  if inv.max_uses > 1 then insert into public.friend_invite_uses (token, user_id) values (inv.token, uid); end if;
  update public.friend_invites
     set use_count = use_count + 1,
         used_by = case when max_uses = 1 then uid else used_by end,
         used_at = case when max_uses = 1 then now() else used_at end
   where token = inv.token;
  select display_name into nm from public.profiles where user_id = inv.inviter;
  return query select 'ok'::text, coalesce(nm, '');
end $$;

create or replace function public.take_invite_news()
returns table (friend_name text, used_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in'; end if;
  return query
    select x.n, x.t from (
      select coalesce(p.display_name, '') as n, i.used_at as t
        from public.friend_invites i left join public.profiles p on p.user_id = i.used_by
       where i.inviter = uid and i.max_uses = 1 and i.used_by is not null and i.acked = false
      union all
      select coalesce(p.display_name, ''), u.used_at
        from public.friend_invite_uses u join public.friend_invites i on i.token = u.token
        left join public.profiles p on p.user_id = u.user_id
       where i.inviter = uid and u.acked = false
    ) x order by x.t;
  update public.friend_invites set acked = true where inviter = uid and max_uses = 1 and used_by is not null and acked = false;
  update public.friend_invite_uses u set acked = true from public.friend_invites i where i.token = u.token and i.inviter = uid and u.acked = false;
end $$;
