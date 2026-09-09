begin;

create table public.project_games (
  project_id uuid not null references public.projects(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  primary key (project_id, game_id)
);

create table public.news_games (
  news_id uuid not null references public.news_posts(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  primary key (news_id, game_id)
);

create index project_games_game_idx on public.project_games (game_id);
create index news_games_game_idx on public.news_games (game_id);

alter table public.project_games enable row level security;
alter table public.news_games enable row level security;

revoke all on table public.project_games from anon, authenticated;
revoke all on table public.news_games from anon, authenticated;
grant select, insert, update, delete on table public.project_games to authenticated;
grant select, insert, update, delete on table public.news_games to authenticated;

create policy "Admins can read project game links"
on public.project_games for select to authenticated
using ((select private.is_admin()));
create policy "Admins can create project game links"
on public.project_games for insert to authenticated
with check ((select private.is_admin()));
create policy "Admins can update project game links"
on public.project_games for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins can delete project game links"
on public.project_games for delete to authenticated
using ((select private.is_admin()));

create policy "Admins can read news game links"
on public.news_games for select to authenticated
using ((select private.is_admin()));
create policy "Admins can create news game links"
on public.news_games for insert to authenticated
with check ((select private.is_admin()));
create policy "Admins can update news game links"
on public.news_games for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins can delete news game links"
on public.news_games for delete to authenticated
using ((select private.is_admin()));

commit;
