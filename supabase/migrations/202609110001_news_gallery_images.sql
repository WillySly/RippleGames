begin;

create table public.news_gallery_images (
  id uuid primary key default gen_random_uuid(),
  news_id uuid not null references public.news_posts(id) on delete cascade,
  storage_path text not null unique,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now()
);

create index news_gallery_news_idx on public.news_gallery_images (news_id, sort_order);

alter table public.news_gallery_images enable row level security;

revoke all on table public.news_gallery_images from anon, authenticated;
grant select on table public.news_gallery_images to anon;
grant select, insert, update, delete on table public.news_gallery_images to authenticated;

create policy "Admins can read news gallery images"
on public.news_gallery_images for select to authenticated
using ((select private.is_admin()));
create policy "Admins can create news gallery images"
on public.news_gallery_images for insert to authenticated
with check ((select private.is_admin()));
create policy "Admins can update news gallery images"
on public.news_gallery_images for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins can delete news gallery images"
on public.news_gallery_images for delete to authenticated
using ((select private.is_admin()));

create policy "Public can read published news gallery images"
on public.news_gallery_images for select to anon, authenticated
using (
  exists (
    select 1 from public.news_posts
    where news_posts.id = news_gallery_images.news_id
      and news_posts.status = 'published'
  )
);

commit;
