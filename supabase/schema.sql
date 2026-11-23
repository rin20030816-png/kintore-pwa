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

-- 使用枚数は本人が読めるだけ。増やすのは下の ai_consume_self() 経由のみで、減らす手段は作らない
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
-- AI読み取り1枚ぶんを、ログイン中の本人の分として数える（サービスキーは使わない）。
-- 上限に達していたら -1、増やせたら今月の使用枚数を返す。1回の命令で数えるので、同時に何枚送られても上限を超えない。
-- 本人が呼べるのは「自分の分を1つ増やす」ことだけ。減らす関数は作らないので、自分で枚数を戻すことはできない
-- 人ごとの上限（初期は誰も入っていない＝全員、標準の上限）。書き込めるのは管理者（SQL Editor）だけ
create table if not exists public.ai_limits (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  monthly_limit integer not null check (monthly_limit >= 0)
);
alter table public.ai_limits enable row level security;
revoke all on public.ai_limits from anon, authenticated;
grant select on public.ai_limits to authenticated;
drop policy if exists "limits_select_own" on public.ai_limits;
create policy "limits_select_own" on public.ai_limits for select to authenticated using (auth.uid() = user_id);
grant select, insert, update, delete on public.ai_limits to service_role;

-- 本人に上限の指定があればそれを使い、なければ呼び出し側が渡した標準の上限を使う
create or replace function public.ai_consume_self(p_month text, p_limit integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); c integer; lim integer;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if p_month !~ '^\d{4}-\d{2}$' then raise exception 'bad month'; end if;
  select coalesce((select monthly_limit from public.ai_limits where user_id = uid), greatest(p_limit, 1)) into lim;
  insert into public.ai_usage (user_id, month, count) values (uid, p_month, 0) on conflict do nothing;
  update public.ai_usage set count = count + 1
    where user_id = uid and month = p_month and count < lim
    returning count into c;
  if c is null then return -1; end if;
  return c;
end $$;

revoke all on function public.ai_consume_self(text, integer) from public, anon;
grant execute on function public.ai_consume_self(text, integer) to authenticated;

-- 画面に出す「今月の上限」を返す
create or replace function public.ai_limit_self(p_default integer)
returns integer language sql stable security definer set search_path = '' as $$
  select coalesce((select monthly_limit from public.ai_limits where user_id = auth.uid()), greatest(p_default, 1))
$$;
revoke all on function public.ai_limit_self(integer) from public, anon;
grant execute on function public.ai_limit_self(integer) to authenticated;

-- 上限を大きくする人は、SQL Editor で次のように入れる（メールアドレスはコードに書かない）:
--   insert into public.ai_limits (user_id, monthly_limit) select id, 100000 from auth.users where email = '○○' on conflict (user_id) do update set monthly_limit = excluded.monthly_limit;

-- （以前の版で作った service_role 用の関数が残っていれば、使わないので消す）
drop function if exists public.ai_try_consume(uuid, text, integer);
drop function if exists public.ai_refund(uuid, text);

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
