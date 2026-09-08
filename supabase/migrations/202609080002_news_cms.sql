begin;

create table public.news_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 200),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  news_date date not null default current_date,
  cover_image_path text,
  short_summary text not null default '' check (char_length(short_summary) <= 1000),
  body_html text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.news_tags (
  news_id uuid not null references public.news_posts(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (news_id, tag_id)
);

create table public.news_projects (
  news_id uuid not null references public.news_posts(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  primary key (news_id, project_id)
);

create index news_posts_date_idx on public.news_posts (news_date desc);
create index news_posts_status_idx on public.news_posts (status);
create index news_projects_project_idx on public.news_projects (project_id);

create or replace function private.set_news_published_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'published' and new.published_at is null then
    new.published_at = now();
  elsif new.status = 'draft' then
    new.published_at = null;
  end if;
  return new;
end;
$$;

create trigger news_posts_set_updated_at
before update on public.news_posts
for each row execute function private.set_updated_at();

create trigger news_posts_set_published_at
before insert or update of status on public.news_posts
for each row execute function private.set_news_published_at();

alter table public.news_posts enable row level security;
alter table public.news_tags enable row level security;
alter table public.news_projects enable row level security;

revoke all on table public.news_posts from anon, authenticated;
revoke all on table public.news_tags from anon, authenticated;
revoke all on table public.news_projects from anon, authenticated;

grant select, insert, update, delete on table public.news_posts to authenticated;
grant select, insert, update, delete on table public.news_tags to authenticated;
grant select, insert, update, delete on table public.news_projects to authenticated;

create policy "Admins can read news posts"
on public.news_posts for select to authenticated
using ((select private.is_admin()));
create policy "Admins can create news posts"
on public.news_posts for insert to authenticated
with check ((select private.is_admin()));
create policy "Admins can update news posts"
on public.news_posts for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins can delete news posts"
on public.news_posts for delete to authenticated
using ((select private.is_admin()));

create policy "Admins can read news tags"
on public.news_tags for select to authenticated
using ((select private.is_admin()));
create policy "Admins can create news tags"
on public.news_tags for insert to authenticated
with check ((select private.is_admin()));
create policy "Admins can update news tags"
on public.news_tags for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins can delete news tags"
on public.news_tags for delete to authenticated
using ((select private.is_admin()));

create policy "Admins can read news project links"
on public.news_projects for select to authenticated
using ((select private.is_admin()));
create policy "Admins can create news project links"
on public.news_projects for insert to authenticated
with check ((select private.is_admin()));
create policy "Admins can update news project links"
on public.news_projects for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins can delete news project links"
on public.news_projects for delete to authenticated
using ((select private.is_admin()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'news-images',
  'news-images',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Admins can read news images"
on storage.objects for select to authenticated
using (bucket_id = 'news-images' and (select private.is_admin()));
create policy "Admins can upload news images"
on storage.objects for insert to authenticated
with check (bucket_id = 'news-images' and (select private.is_admin()));
create policy "Admins can update news images"
on storage.objects for update to authenticated
using (bucket_id = 'news-images' and (select private.is_admin()))
with check (bucket_id = 'news-images' and (select private.is_admin()));
create policy "Admins can delete news images"
on storage.objects for delete to authenticated
using (bucket_id = 'news-images' and (select private.is_admin()));

commit;
