-- 友達機能: 表・権限(RLS)・関数。Supabase の SQL Editor で、1回だけ実行します（何度実行しても壊れません）。
-- 方針: 友達の情報は、表を直接読ませず、すべて「関数」を通して渡す。関数が、友達であること・おたがいに「見せる」がONであること・ブロックしていないことを確かめる。
--       友達に見えるのは「表示名」「行った日」「ポイント」だけ。メールアドレス・種目・重さ・回数・体重は、見えない。

-- ============ 表 ============
-- 表示名と「見せる」の設定（1人1行）
create table if not exists public.profiles (
  user_id      uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 12 and display_name = btrim(display_name)),
  share        boolean not null default false,
  updated_at   timestamptz not null default now()
);

-- 友達の関係（user_a < user_b の順に1行だけ入れる）
create table if not exists public.friendships (
  user_a     uuid not null references auth.users(id) on delete cascade,
  user_b     uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);
create index if not exists friendships_b_idx on public.friendships (user_b);

-- ブロック（ブロックした人 → された人）
create table if not exists public.blocks (
  blocker    uuid not null references auth.users(id) on delete cascade,
  blocked    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);

-- 招待リンク（1人だけ使えて、7日で切れる）
create table if not exists public.friend_invites (
  token      text primary key,
  inviter    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  used_by    uuid references auth.users(id) on delete set null,
  used_at    timestamptz,
  acked      boolean not null default false
);
create index if not exists friend_invites_inviter_idx on public.friend_invites (inviter);

-- 1日ごとの「行った日」と「ポイント」（友達に見せるのは、この2つだけ）
create table if not exists public.daily_points (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day        date not null,
  points     integer not null check (points between 0 and 3000),
  trained    boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

-- ============ 権限（RLS） ============
alter table public.profiles       enable row level security;
alter table public.friendships    enable row level security;
alter table public.blocks         enable row level security;
alter table public.friend_invites enable row level security;
alter table public.daily_points   enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "friendships_select_own" on public.friendships;
drop policy if exists "blocks_select_own" on public.blocks;
drop policy if exists "invites_select_own" on public.friend_invites;
drop policy if exists "points_select_own" on public.daily_points;
drop policy if exists "points_insert_own" on public.daily_points;
drop policy if exists "points_update_own" on public.daily_points;
drop policy if exists "points_delete_own" on public.daily_points;

create policy "profiles_select_own" on public.profiles for select to authenticated using (auth.uid() = user_id);
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (auth.uid() = user_id);
create policy "profiles_update_own" on public.profiles for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "friendships_select_own" on public.friendships for select to authenticated using (auth.uid() in (user_a, user_b));
create policy "blocks_select_own" on public.blocks for select to authenticated using (auth.uid() = blocker);
create policy "invites_select_own" on public.friend_invites for select to authenticated using (auth.uid() = inviter);
create policy "points_select_own" on public.daily_points for select to authenticated using (auth.uid() = user_id);
create policy "points_insert_own" on public.daily_points for insert to authenticated with check (auth.uid() = user_id);
create policy "points_update_own" on public.daily_points for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "points_delete_own" on public.daily_points for delete to authenticated using (auth.uid() = user_id);

-- 表への直接の権限：ログインしていない人(anon)には何も与えない。友達・ブロック・招待は、読むだけ（書くのは関数だけ）
revoke all on public.profiles, public.friendships, public.blocks, public.friend_invites, public.daily_points from anon;
revoke all on public.profiles, public.friendships, public.blocks, public.friend_invites, public.daily_points from authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select on public.friendships, public.blocks, public.friend_invites to authenticated;
grant select, insert, update, delete on public.daily_points to authenticated;
grant select, insert, update, delete on public.profiles, public.friendships, public.blocks, public.friend_invites, public.daily_points to service_role;

-- ============ 関数 ============
-- ブロックの関係があるか（どちらが、どちらをブロックしていても）
create or replace function public._blocked(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.blocks where (blocker = a and blocked = b) or (blocker = b and blocked = a))
$$;
revoke all on function public._blocked(uuid, uuid) from public, anon, authenticated;

create or replace function public._friend_count(u uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.friendships where user_a = u or user_b = u
$$;
revoke all on function public._friend_count(uuid) from public, anon, authenticated;

-- 招待リンクを作る（友達が30人のとき・未使用の招待が5本あるときは作れない）
create or replace function public.create_invite()
returns table (token text, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); t text; ex timestamptz;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from public.profiles where user_id = uid) then raise exception 'need_profile'; end if;
  if public._friend_count(uid) >= 30 then raise exception 'friends_full'; end if;
  delete from public.friend_invites fi where fi.inviter = uid and fi.used_by is null and fi.expires_at < now();
  if (select count(*) from public.friend_invites fi where fi.inviter = uid and fi.used_by is null) >= 5 then raise exception 'too_many_invites'; end if;
  t := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  insert into public.friend_invites (inviter, token) values (uid, t) returning friend_invites.expires_at into ex;
  return query select t, ex;
end $$;

-- 招待リンクを開いたとき、「だれからの招待か」を見せるために確かめる（まだ友達にはならない）
create or replace function public.peek_invite(p_token text)
returns table (status text, inviter_name text)
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); inv public.friend_invites; nm text;
begin
  if uid is null then raise exception 'not signed in'; end if;
  select * into inv from public.friend_invites where token = lower(btrim(p_token));
  if not found then return query select 'not_found'::text, null::text; return; end if;
  if inv.used_by is not null then return query select 'used'::text, null::text; return; end if;
  if inv.expires_at < now() then return query select 'expired'::text, null::text; return; end if;
  if inv.inviter = uid then return query select 'self'::text, null::text; return; end if;
  if public._blocked(inv.inviter, uid) then return query select 'unavailable'::text, null::text; return; end if;
  if exists (select 1 from public.friendships where user_a = least(uid, inv.inviter) and user_b = greatest(uid, inv.inviter)) then
    return query select 'already'::text, null::text; return;
  end if;
  select display_name into nm from public.profiles where user_id = inv.inviter;
  return query select 'ok'::text, coalesce(nm, '');
end $$;

-- 招待リンクを使って友達になる（その場で友達になる。招待した人には、次にアプリを開いたときに知らせる）
create or replace function public.accept_invite(p_token text)
returns table (status text, friend_name text)
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); inv public.friend_invites; nm text;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from public.profiles where user_id = uid) then return query select 'need_profile'::text, null::text; return; end if;
  select * into inv from public.friend_invites where token = lower(btrim(p_token)) for update;
  if not found then return query select 'not_found'::text, null::text; return; end if;
  if inv.used_by is not null then return query select 'used'::text, null::text; return; end if;
  if inv.expires_at < now() then return query select 'expired'::text, null::text; return; end if;
  if inv.inviter = uid then return query select 'self'::text, null::text; return; end if;
  if public._blocked(inv.inviter, uid) then return query select 'unavailable'::text, null::text; return; end if;
  if exists (select 1 from public.friendships where user_a = least(uid, inv.inviter) and user_b = greatest(uid, inv.inviter)) then
    return query select 'already'::text, null::text; return;
  end if;
  if public._friend_count(uid) >= 30 then return query select 'my_full'::text, null::text; return; end if;
  if public._friend_count(inv.inviter) >= 30 then return query select 'their_full'::text, null::text; return; end if;
  insert into public.friendships (user_a, user_b) values (least(uid, inv.inviter), greatest(uid, inv.inviter));
  update public.friend_invites set used_by = uid, used_at = now() where token = inv.token;
  select display_name into nm from public.profiles where user_id = inv.inviter;
  return query select 'ok'::text, coalesce(nm, '');
end $$;

-- 招待した人が、自分の招待が使われたことを確かめる（知らせを出したら、確認済みにする）
create or replace function public.take_invite_news()
returns table (friend_name text, used_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in'; end if;
  return query
    select coalesce(p.display_name, ''), i.used_at
    from public.friend_invites i left join public.profiles p on p.user_id = i.used_by
    where i.inviter = uid and i.used_by is not null and i.acked = false
    order by i.used_at;
  update public.friend_invites set acked = true where inviter = uid and used_by is not null and acked = false;
end $$;

-- 友達の一覧（表示名と、相手が「見せる」をONにしているか）。メールアドレスは返さない
create or replace function public.list_friends()
returns table (friend_id uuid, display_name text, they_share boolean, since timestamptz)
language sql stable security definer set search_path = '' as $$
  select o.id, coalesce(p.display_name, ''), coalesce(p.share, false), f.created_at
  from public.friendships f
  cross join lateral (select case when f.user_a = auth.uid() then f.user_b else f.user_a end as id) o
  left join public.profiles p on p.user_id = o.id
  where auth.uid() in (f.user_a, f.user_b) and not public._blocked(auth.uid(), o.id)
  order by f.created_at
$$;

create or replace function public.remove_friend(p_friend uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from public.friendships where user_a = least(auth.uid(), p_friend) and user_b = greatest(auth.uid(), p_friend);
end $$;

create or replace function public.block_user(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_user = auth.uid() then raise exception 'self'; end if;
  delete from public.friendships where user_a = least(auth.uid(), p_user) and user_b = greatest(auth.uid(), p_user);
  insert into public.blocks (blocker, blocked) values (auth.uid(), p_user) on conflict do nothing;
end $$;

create or replace function public.unblock_user(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from public.blocks where blocker = auth.uid() and blocked = p_user;
end $$;

create or replace function public.list_blocks()
returns table (user_id uuid, display_name text)
language sql stable security definer set search_path = '' as $$
  select b.blocked, coalesce(p.display_name, '') from public.blocks b left join public.profiles p on p.user_id = b.blocked
  where b.blocker = auth.uid() order by b.created_at
$$;

-- 友達の「行った日」と「ポイント」。おたがいに「見せる」がONで、友達で、ブロックがないときだけ返す。自分の分は、いつでも返す。
-- 返せる期間は、最長62日ぶん
create or replace function public.friends_activity(p_from date, p_to date)
returns table (user_id uuid, display_name text, day date, points integer, trained boolean)
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid(); my_share boolean;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if p_to < p_from or p_to - p_from > 62 then raise exception 'bad range'; end if;
  select share into my_share from public.profiles where profiles.user_id = uid;
  return query
    select d.user_id, p.display_name, d.day, d.points, d.trained
    from public.daily_points d
    join public.profiles p on p.user_id = d.user_id
    where d.day between p_from and p_to
      and (d.user_id = uid
           or (coalesce(my_share, false) and p.share
               and exists (select 1 from public.friendships f where f.user_a = least(uid, d.user_id) and f.user_b = greatest(uid, d.user_id))
               and not public._blocked(uid, d.user_id)));
end $$;

-- 実行できる人: ログインしている人だけ
do $$
declare f text;
begin
  foreach f in array array[
    'create_invite()', 'peek_invite(text)', 'accept_invite(text)', 'take_invite_news()', 'list_friends()',
    'remove_friend(uuid)', 'block_user(uuid)', 'unblock_user(uuid)', 'list_blocks()', 'friends_activity(date, date)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
