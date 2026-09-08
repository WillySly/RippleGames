begin;

update storage.buckets
set public = true
where id in ('project-images', 'news-images');

drop policy if exists "Public can read published project images" on storage.objects;
drop policy if exists "Public can read published news images" on storage.objects;

commit;
