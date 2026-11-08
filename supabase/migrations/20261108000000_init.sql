-- Shashin: initial schema, RLS and storage.

------------------------------------------------------------------ tables

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text check (char_length(display_name) <= 40),
  avatar_path text,
  created_at timestamptz not null default now()
);

create table public.friendships (
  requester uuid not null references public.profiles (id) on delete cascade,
  addressee uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (requester, addressee),
  check (requester <> addressee)
);
-- One row per pair, whichever direction it was sent in.
create unique index friendships_pair_key
  on public.friendships (least(requester, addressee), greatest(requester, addressee));
create index friendships_addressee_idx on public.friendships (addressee);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  image_path text not null,
  caption text check (char_length(caption) <= 200),
  post_date date not null, -- the poster's LOCAL day
  created_at timestamptz not null default now(),
  constraint posts_one_per_day unique (user_id, post_date)
);
create index posts_user_date_idx on public.posts (user_id, post_date desc);
create index posts_created_at_idx on public.posts (created_at desc);

------------------------------------------------------------------ functions

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  uname text := lower(trim(new.raw_user_meta_data ->> 'username'));
begin
  if uname is null or uname !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'Username must be 3-20 characters using a-z, 0-9 or _'
      using errcode = '22023';
  end if;
  insert into public.profiles (id, username) values (new.id, uname);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester = a and f.addressee = b) or (f.requester = b and f.addressee = a))
  );
$$;
revoke execute on function public.are_friends(uuid, uuid) from public, anon;
grant execute on function public.are_friends(uuid, uuid) to authenticated;

-- Used by the sign-up screen before the user has a session.
create function public.username_available(name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select lower(name) ~ '^[a-z0-9_]{3,20}$'
     and not exists (select 1 from public.profiles p where p.username = lower(name));
$$;
revoke execute on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;

------------------------------------------------------------------ RLS

alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.posts enable row level security;

-- profiles: any signed-in user can read (search); owner can edit display name / avatar only.
create policy "profiles: signed-in read" on public.profiles
  for select to authenticated using (true);
create policy "profiles: owner update" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke update on public.profiles from authenticated, anon;
grant update (display_name, avatar_path) on public.profiles to authenticated;

-- friendships: only the two people involved.
create policy "friendships: participants read" on public.friendships
  for select to authenticated
  using ((select auth.uid()) in (requester, addressee));
create policy "friendships: request as requester" on public.friendships
  for insert to authenticated
  with check (requester = (select auth.uid()) and status = 'pending');
create policy "friendships: addressee accepts" on public.friendships
  for update to authenticated
  using (addressee = (select auth.uid()) and status = 'pending')
  with check (addressee = (select auth.uid()) and status = 'accepted');
create policy "friendships: either deletes" on public.friendships
  for delete to authenticated
  using ((select auth.uid()) in (requester, addressee));
revoke update on public.friendships from authenticated, anon;
grant update (status) on public.friendships to authenticated;

-- posts: mine or my friends'; insert my own for (roughly) today; no edits.
create policy "posts: own or friends read" on public.posts
  for select to authenticated
  using (user_id = (select auth.uid()) or public.are_friends((select auth.uid()), user_id));
create policy "posts: insert own today" on public.posts
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and post_date between (now() at time zone 'utc')::date - 1
                      and (now() at time zone 'utc')::date + 1
  );
create policy "posts: delete own" on public.posts
  for delete to authenticated
  using (user_id = (select auth.uid()));
revoke update on public.posts from authenticated, anon;

------------------------------------------------------------------ storage

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('photos', 'photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp']);

-- photos/<user_id>/<post_date>-<timestamp>.jpg : owner or friends can read.
create policy "photos: read own or friends" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'photos'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (
        (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
        and public.are_friends((select auth.uid()), ((storage.foldername(name))[1])::uuid)
      )
    )
  );
create policy "photos: upload own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "photos: delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- avatars/<user_id>/avatar-<ts>.jpg : any signed-in user can read (search, invites).
create policy "avatars: signed-in read" on storage.objects
  for select to authenticated using (bucket_id = 'avatars');
create policy "avatars: upload own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars: delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

------------------------------------------------------------------ realtime

alter publication supabase_realtime add table public.posts;
