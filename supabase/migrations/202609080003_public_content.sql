begin;

grant select on table public.project_groups to anon;
grant select on table public.projects to anon;
grant select on table public.tags to anon;
grant select on table public.project_tags to anon;
grant select on table public.project_gallery_images to anon;
grant select on table public.news_posts to anon;
grant select on table public.news_tags to anon;
grant select on table public.news_projects to anon;

create policy "Public can read published projects"
on public.projects for select to anon, authenticated
using (status = 'published');

create policy "Public can read groups with published projects"
on public.project_groups for select to anon, authenticated
using (
  exists (
    select 1 from public.projects
    where projects.project_group_id = project_groups.id
      and projects.status = 'published'
  )
);

create policy "Public can read tags used by published content"
on public.tags for select to anon, authenticated
using (
  exists (
    select 1
    from public.project_tags
    join public.projects on projects.id = project_tags.project_id
    where project_tags.tag_id = tags.id
      and projects.status = 'published'
  )
  or exists (
    select 1
    from public.news_tags
    join public.news_posts on news_posts.id = news_tags.news_id
    where news_tags.tag_id = tags.id
      and news_posts.status = 'published'
  )
);

create policy "Public can read published project tags"
on public.project_tags for select to anon, authenticated
using (
  exists (
    select 1 from public.projects
    where projects.id = project_tags.project_id
      and projects.status = 'published'
  )
);

create policy "Public can read published project gallery images"
on public.project_gallery_images for select to anon, authenticated
using (
  exists (
    select 1 from public.projects
    where projects.id = project_gallery_images.project_id
      and projects.status = 'published'
  )
);

create policy "Public can read published news"
on public.news_posts for select to anon, authenticated
using (status = 'published');

create policy "Public can read published news tags"
on public.news_tags for select to anon, authenticated
using (
  exists (
    select 1 from public.news_posts
    where news_posts.id = news_tags.news_id
      and news_posts.status = 'published'
  )
);

create policy "Public can read published news project links"
on public.news_projects for select to anon, authenticated
using (
  exists (
    select 1 from public.news_posts
    where news_posts.id = news_projects.news_id
      and news_posts.status = 'published'
  )
  and exists (
    select 1 from public.projects
    where projects.id = news_projects.project_id
      and projects.status = 'published'
  )
);

create policy "Public can read published project images"
on storage.objects for select to anon, authenticated
using (
  bucket_id = 'project-images'
  and exists (
    select 1 from public.projects
    where projects.id::text = (storage.foldername(name))[1]
      and projects.status = 'published'
  )
);

create policy "Public can read published news images"
on storage.objects for select to anon, authenticated
using (
  bucket_id = 'news-images'
  and exists (
    select 1 from public.news_posts
    where news_posts.id::text = (storage.foldername(name))[1]
      and news_posts.status = 'published'
  )
);

commit;
