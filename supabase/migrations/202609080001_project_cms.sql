begin;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.project_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 160),
  short_description text not null default '' check (char_length(short_description) <= 600),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  project_group_id uuid not null references public.project_groups(id) on delete restrict,
  title text not null check (char_length(trim(title)) between 1 and 200),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  short_summary text not null default '' check (char_length(short_summary) <= 1000),
  cover_image_path text,
  overview_html text not null default '',
  challenge_html text not null default '',
  what_we_did_html text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  created_at timestamptz not null default now()
);

create table public.project_tags (
  project_id uuid not null references public.projects(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (project_id, tag_id)
);

create table public.project_gallery_images (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  storage_path text not null unique,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now()
);

create index project_groups_name_idx on public.project_groups (lower(name));
create index projects_group_idx on public.projects (project_group_id);
create index projects_status_idx on public.projects (status);
create index project_gallery_project_idx on public.project_gallery_images (project_id, sort_order);
create index tags_name_idx on public.tags (lower(name));

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
  );
$$;

revoke execute on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.set_project_published_at()
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

create trigger project_groups_set_updated_at
before update on public.project_groups
for each row execute function private.set_updated_at();

create trigger projects_set_updated_at
before update on public.projects
for each row execute function private.set_updated_at();

create trigger projects_set_published_at
before insert or update of status on public.projects
for each row execute function private.set_project_published_at();

alter table public.admin_users enable row level security;
alter table public.project_groups enable row level security;
alter table public.projects enable row level security;
alter table public.tags enable row level security;
alter table public.project_tags enable row level security;
alter table public.project_gallery_images enable row level security;

revoke all on table public.admin_users from anon, authenticated;
grant select on table public.admin_users to authenticated;

revoke all on table public.project_groups from anon, authenticated;
revoke all on table public.projects from anon, authenticated;
revoke all on table public.tags from anon, authenticated;
revoke all on table public.project_tags from anon, authenticated;
revoke all on table public.project_gallery_images from anon, authenticated;

grant select, insert, update, delete on table public.project_groups to authenticated;
grant select, insert, update, delete on table public.projects to authenticated;
grant select, insert, update, delete on table public.tags to authenticated;
grant select, insert, update, delete on table public.project_tags to authenticated;
grant select, insert, update, delete on table public.project_gallery_images to authenticated;

create policy "Users can read their own admin membership"
on public.admin_users for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Admins can read project groups"
on public.project_groups for select to authenticated
using ((select private.is_admin()));
create policy "Admins can create project groups"
on public.project_groups for insert to authenticated
with check ((select private.is_admin()));
create policy "Admins can update project groups"
on public.project_groups for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins can delete project groups"
on public.project_groups for delete to authenticated
using ((select private.is_admin()));

create policy "Admins can read projects"
on public.projects for select to authenticated
using ((select private.is_admin()));
create policy "Admins can create projects"
on public.projects for insert to authenticated
with check ((select private.is_admin()));
create policy "Admins can update projects"
on public.projects for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins can delete projects"
on public.projects for delete to authenticated
using ((select private.is_admin()));

create policy "Admins can read tags"
on public.tags for select to authenticated
using ((select private.is_admin()));
create policy "Admins can create tags"
on public.tags for insert to authenticated
with check ((select private.is_admin()));
create policy "Admins can update tags"
on public.tags for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins can delete tags"
on public.tags for delete to authenticated
using ((select private.is_admin()));

create policy "Admins can read project tags"
on public.project_tags for select to authenticated
using ((select private.is_admin()));
create policy "Admins can create project tags"
on public.project_tags for insert to authenticated
with check ((select private.is_admin()));
create policy "Admins can update project tags"
on public.project_tags for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins can delete project tags"
on public.project_tags for delete to authenticated
using ((select private.is_admin()));

create policy "Admins can read gallery images"
on public.project_gallery_images for select to authenticated
using ((select private.is_admin()));
create policy "Admins can create gallery images"
on public.project_gallery_images for insert to authenticated
with check ((select private.is_admin()));
create policy "Admins can update gallery images"
on public.project_gallery_images for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins can delete gallery images"
on public.project_gallery_images for delete to authenticated
using ((select private.is_admin()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-images',
  'project-images',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Admins can read project images"
on storage.objects for select to authenticated
using (bucket_id = 'project-images' and (select private.is_admin()));
create policy "Admins can upload project images"
on storage.objects for insert to authenticated
with check (bucket_id = 'project-images' and (select private.is_admin()));
create policy "Admins can update project images"
on storage.objects for update to authenticated
using (bucket_id = 'project-images' and (select private.is_admin()))
with check (bucket_id = 'project-images' and (select private.is_admin()));
create policy "Admins can delete project images"
on storage.objects for delete to authenticated
using (bucket_id = 'project-images' and (select private.is_admin()));

commit;
