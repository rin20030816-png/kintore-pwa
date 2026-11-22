-- 筋トレは力なり: Supabase のテーブル・権限(RLS)・関数
-- Supabase の「SQL Editor」に全部貼り付けて、1回だけ実行します。
-- 何度実行しても壊れないように書いてあります。

-- ============ テーブル ============
-- 1日ぶんの記録。主キーは (user_id, date)。記録を消したときも行は消さず entries を空配列にする
create table if not exists public.workout_days (
  user_id    uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  date       date        not null,
  entries    jsonb       not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, date),
  constraint workout_days_entries_array check (jsonb_typeof(entries) = 'array'),
  constraint workout_days_entries_size  check (pg_column_size(entries) < 200000)
);

-- 種目・体重・設定（1人1行）
create table if not exists public.user_meta (
  user_id    uuid        primary key default auth.uid() references auth.users(id) on delete cascade,
  exercises  jsonb       not null default '[]'::jsonb,
  bodyweight jsonb       not null default '{}'::jsonb,
  settings   jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint user_meta_types check (
    jsonb_typeof(exercises) = 'array' and jsonb_typeof(bodyweight) = 'object' and jsonb_typeof(settings) = 'object'),
  constraint user_meta_size check (pg_column_size(exercises) + pg_column_size(bodyweight) + pg_column_size(settings) < 500000)
);

-- AI読み取りの月ごとの使用枚数
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  month   text not null,
  count   integer not null default 0 check (count >= 0),
  primary key (user_id, month)
);

-- 更新日時はサーバー側で付ける（端末の時計に左右されない）
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists touch_workout_days on public.workout_days;
create trigger touch_workout_days before insert or update on public.workout_days
  for each row execute function public.touch_updated_at();
drop trigger if exists touch_user_meta on public.user_meta;
create trigger touch_user_meta before insert or update on public.user_meta
  for each row execute function public.touch_updated_at();

-- ============ Row Level Security（本人の行だけ読み書きできる） ============
alter table public.workout_days enable row level security;
alter table public.user_meta    enable row level security;
alter table public.ai_usage     enable row level security;

-- 作り直しても二重にならないよう、先に消してから作る
drop policy if exists "days_select_own"  on public.workout_days;
drop policy if exists "days_insert_own"  on public.workout_days;
drop policy if exists "days_update_own"  on public.workout_days;
drop policy if exists "meta_select_own"  on public.user_meta;
drop policy if exists "meta_insert_own"  on public.user_meta;
drop policy if exists "meta_update_own"  on public.user_meta;
drop policy if exists "usage_select_own" on public.ai_usage;

create policy "days_select_own" on public.workout_days for select to authenticated using (auth.uid() = user_id);
create policy "days_insert_own" on public.workout_days for insert to authenticated with check (auth.uid() = user_id);
create policy "days_update_own" on public.workout_days for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "meta_select_own" on public.user_meta for select to authenticated using (auth.uid() = user_id);
create policy "meta_insert_own" on public.user_meta for insert to authenticated with check (auth.uid() = user_id);
create policy "meta_update_own" on public.user_meta for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 使用枚数は本人が読めるだけ。増やす・減らすのはサーバー(service_role)だけ
create policy "usage_select_own" on public.ai_usage for select to authenticated using (auth.uid() = user_id);

-- ログインしていない人(anon)には、テーブルの権限そのものを与えない
revoke all on public.workout_days, public.user_meta, public.ai_usage from anon;
revoke insert, update, delete on public.ai_usage from authenticated;
-- 記録の行をブラウザから直接消すことはしない（消したことは entries を空にして伝える）
revoke delete on public.workout_days, public.user_meta from authenticated;

-- 必要な権限を、はっきり与える（プロジェクト作成時の「新しいテーブルに自動で権限を付ける」の設定がオンでもオフでも動くように）
-- 実際に何が読み書きできるかは、上のRLSのポリシーが行ごとに決める
grant usage on schema public to authenticated, service_role;
grant select, insert, update on public.workout_days, public.user_meta to authenticated;
grant select on public.ai_usage to authenticated;
grant select, insert, update, delete on public.workout_days, public.user_meta, public.ai_usage to service_role;

-- ============ 関数 ============
-- AI読み取り1枚ぶんを使う。上限に達していたら -1、使えたら今月の使用枚数を返す。
-- 1回の命令で数えるので、同時に何枚送られても上限を超えない。サーバー(service_role)だけが呼べる
create or replace function public.ai_try_consume(p_user uuid, p_month text, p_limit integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare c integer;
begin
  insert into public.ai_usage (user_id, month, count) values (p_user, p_month, 0) on conflict do nothing;
  update public.ai_usage set count = count + 1
    where user_id = p_user and month = p_month and count < p_limit
    returning count into c;
  if c is null then return -1; end if;
  return c;
end $$;

-- 読み取りに失敗したときに1枚ぶん戻す
create or replace function public.ai_refund(p_user uuid, p_month text)
returns void language sql security definer set search_path = '' as $$
  update public.ai_usage set count = greatest(count - 1, 0) where user_id = p_user and month = p_month;
$$;

revoke all on function public.ai_try_consume(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.ai_refund(uuid, text)               from public, anon, authenticated;
grant execute on function public.ai_try_consume(uuid, text, integer) to service_role;
grant execute on function public.ai_refund(uuid, text)               to service_role;

-- アカウント削除: ログイン中の本人のアカウントを消す。記録・使用枚数は「on delete cascade」で一緒に消える
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from auth.users where id = auth.uid();
end $$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ============ 別の端末にすぐ反映する(Realtime) ============
do $$ begin
  begin alter publication supabase_realtime add table public.workout_days; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.user_meta;    exception when duplicate_object then null; end;
end $$;
