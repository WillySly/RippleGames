begin;

grant select on table public.project_games to anon;
grant select on table public.news_games to anon;

create policy "Public can read published project game links"
on public.project_games for select to anon, authenticated
using (
  exists (
    select 1 from public.projects
    where projects.id = project_games.project_id
      and projects.status = 'published'
  )
  and exists (
    select 1 from public.games
    where games.id = project_games.game_id
      and games.is_active
  )
);

create policy "Public can read published news game links"
on public.news_games for select to anon, authenticated
using (
  exists (
    select 1 from public.news_posts
    where news_posts.id = news_games.news_id
      and news_posts.status = 'published'
  )
  and exists (
    select 1 from public.games
    where games.id = news_games.game_id
      and games.is_active
  )
);

commit;
