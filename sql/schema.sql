-- شغّل هذا الملف كاملاً في Supabase ← SQL Editor ← New query ← Run

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  full_name text not null,
  bio text default '',
  points int not null default 0,
  created_at timestamptz default now()
);
create table posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  content text not null check (char_length(content) <= 1000),
  is_story boolean not null default false,
  created_at timestamptz default now()
);
create table likes (
  post_id uuid references posts(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  primary key (post_id, user_id)
);
create table comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  content text not null check (char_length(content) <= 300),
  created_at timestamptz default now()
);
create table messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references profiles(id) on delete cascade,
  receiver_id uuid not null references profiles(id) on delete cascade,
  content text not null check (char_length(content) <= 500),
  created_at timestamptz default now()
);
create table challenges (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references profiles(id) on delete cascade,
  subject_name text not null,
  num int not null,
  questions jsonb not null,
  status text not null default 'waiting',   -- waiting | started
  created_at timestamptz default now()
);
create table challenge_players (
  challenge_id uuid references challenges(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  score int not null default 0,
  finished boolean not null default false,
  primary key (challenge_id, user_id)
);
create table awarded (            -- يمنع تكرار النقاط على نفس المنشور
  user_id uuid, post_id uuid, kind text,
  primary key (user_id, post_id, kind)
);

create index on posts (created_at desc);
create index on messages (sender_id, receiver_id, created_at);

-- ───── النقاط ─────
create or replace function add_points(n int) returns void
language sql security definer set search_path = public as $$
  update profiles set points = points + least(greatest(n, 0), 5) where id = auth.uid();
$$;

-- إعجاب = نقطة ، تعليق = نقطتان (مرة لكل منشور، وليس على منشورك أنت)
create or replace function award() returns trigger
language plpgsql security definer set search_path = public as $$
declare owner uuid; k text; p int;
begin
  select user_id into owner from posts where id = new.post_id;
  if owner = new.user_id then return new; end if;
  if tg_table_name = 'likes' then k := 'like'; p := 1; else k := 'comment'; p := 2; end if;
  insert into awarded values (new.user_id, new.post_id, k) on conflict do nothing;
  if found then update profiles set points = points + p where id = new.user_id; end if;
  return new;
end $$;
create trigger t_like after insert on likes for each row execute function award();
create trigger t_comment after insert on comments for each row execute function award();

-- ───── الحماية RLS ─────
alter table profiles enable row level security;
alter table posts enable row level security;
alter table likes enable row level security;
alter table comments enable row level security;
alter table messages enable row level security;
alter table challenges enable row level security;
alter table challenge_players enable row level security;
alter table awarded enable row level security;

create policy "profiles read" on profiles for select to authenticated using (true);
create policy "profiles update own" on profiles for update to authenticated using (id = auth.uid());
revoke update on profiles from authenticated;
grant update (full_name, bio) on profiles to authenticated;   -- لا يستطيع أحد تعديل نقاطه يدوياً

create policy "posts read" on posts for select to authenticated using (true);
create policy "posts insert" on posts for insert to authenticated with check (user_id = auth.uid());
create policy "posts delete" on posts for delete to authenticated using (user_id = auth.uid());

create policy "likes read" on likes for select to authenticated using (true);
create policy "likes insert" on likes for insert to authenticated with check (user_id = auth.uid());
create policy "likes delete" on likes for delete to authenticated using (user_id = auth.uid());

create policy "comments read" on comments for select to authenticated using (true);
create policy "comments insert" on comments for insert to authenticated with check (user_id = auth.uid());

create policy "msg read" on messages for select to authenticated using (auth.uid() in (sender_id, receiver_id));
create policy "msg insert" on messages for insert to authenticated with check (sender_id = auth.uid());

create policy "ch read" on challenges for select to authenticated using (true);
create policy "ch insert" on challenges for insert to authenticated with check (host_id = auth.uid());
create policy "ch update host" on challenges for update to authenticated using (host_id = auth.uid());

create policy "cp read" on challenge_players for select to authenticated using (true);
create policy "cp insert" on challenge_players for insert to authenticated with check (user_id = auth.uid());
create policy "cp update own" on challenge_players for update to authenticated using (user_id = auth.uid());

-- ───── التحديث المباشر ─────
alter publication supabase_realtime add table messages, challenges, challenge_players;
