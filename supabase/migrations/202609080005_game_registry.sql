begin;

create table public.games (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 200),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  cover_image_path text,
  playable_url text not null check (char_length(trim(playable_url)) between 1 and 2048),
  is_active boolean not null default false,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.game_tags (
  game_id uuid not null references public.games(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (game_id, tag_id)
);

create index games_active_idx on public.games (is_active);
create index game_tags_tag_idx on public.game_tags (tag_id);

create trigger games_set_updated_at
before update on public.games
for each row execute function private.set_updated_at();

alter table public.games enable row level security;
alter table public.game_tags enable row level security;

revoke all on table public.games from anon, authenticated;
revoke all on table public.game_tags from anon, authenticated;
grant select on table public.games to anon;
grant select on table public.game_tags to anon;
grant select, insert, update, delete on table public.games to authenticated;
grant select, insert, update, delete on table public.game_tags to authenticated;

create policy "Admins can read games"
on public.games for select to authenticated
using ((select private.is_admin()));
create policy "Admins can create games"
on public.games for insert to authenticated
with check ((select private.is_admin()));
create policy "Admins can update games"
on public.games for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins can delete games"
on public.games for delete to authenticated
using ((select private.is_admin()));
create policy "Public can read active games"
on public.games for select to anon, authenticated
using (is_active);

create policy "Admins can read game tags"
on public.game_tags for select to authenticated
using ((select private.is_admin()));
create policy "Admins can create game tags"
on public.game_tags for insert to authenticated
with check ((select private.is_admin()));
create policy "Admins can update game tags"
on public.game_tags for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins can delete game tags"
on public.game_tags for delete to authenticated
using ((select private.is_admin()));
create policy "Public can read active game tags"
on public.game_tags for select to anon, authenticated
using (
  exists (
    select 1 from public.games
    where games.id = game_tags.game_id
      and games.is_active
  )
);

create policy "Public can read tags used by active games"
on public.tags for select to anon, authenticated
using (
  exists (
    select 1
    from public.game_tags
    join public.games on games.id = game_tags.game_id
    where game_tags.tag_id = tags.id
      and games.is_active
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'game-images',
  'game-images',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Admins can read game images"
on storage.objects for select to authenticated
using (bucket_id = 'game-images' and (select private.is_admin()));
create policy "Admins can upload game images"
on storage.objects for insert to authenticated
with check (bucket_id = 'game-images' and (select private.is_admin()));
create policy "Admins can update game images"
on storage.objects for update to authenticated
using (bucket_id = 'game-images' and (select private.is_admin()))
with check (bucket_id = 'game-images' and (select private.is_admin()));
create policy "Admins can delete game images"
on storage.objects for delete to authenticated
using (bucket_id = 'game-images' and (select private.is_admin()));

commit;
