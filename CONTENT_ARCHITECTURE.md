# Ripple Games content architecture

This document defines the public content model and URL structure that the future content system and admin panel should implement. The current site remains static while these routes are introduced incrementally.

## Public navigation

1. About Us (`/#about`)
2. Games (`/games.html`)
3. Projects (`/projects.html`)
4. News (`/news.html`)
5. Contact (`/#contact`)

Games is a filtered view of published Projects with a game-related tag. It is not a separate content type.

## Content types

### Project Group

An umbrella engagement containing one or more Projects.

- Title
- Slug
- Summary
- Hero image (optional)
- Sort order
- Publication status

### Project

An individual piece of work belonging to one Project Group.

- Title
- Slug
- Project Group (required, one)
- Summary
- Body/content blocks
- Hero image and gallery
- Tags (zero or more)
- Publication status and publication date

### News

An activity, event, launch, or update.

- Title
- Slug
- Excerpt
- Body/content blocks
- Cover image and gallery
- Related Projects (zero or more)
- Tags (zero or more)
- Publication status and publication date

### Tag

A shared classification used by Projects and News. Tags power filtered collections such as Games.

- Name
- Slug

## Intended route shape

- `/projects` — published Project Groups with their published Projects
- `/projects/{project-slug}` — Project detail, related News, and related Projects
- `/news` — published News in reverse chronological order
- `/news/{news-slug}` — News detail and linked Projects
- `/games` — published Projects matching configured game tags
- `/admin` — protected content management; not part of the current increment

The `.html` URLs in the current static implementation are transitional equivalents of the collection routes above.

## Publication rules

- Draft content never appears publicly.
- A Project appears only when both it and its Project Group are published.
- News may link to multiple Projects; a Project derives related News from that relationship.
- Related Projects should default to other published Projects in the same Project Group, with room for explicit curation later.

## Current increment

Implemented now:

- the five-item public navigation;
- separate Games, Projects, and News collection pages;
- Project grouping on the Projects page;
- an explicit empty state for News;
- a shared responsive navigation script.

Deferred:

- CMS and database selection;
- authentication and `/admin`;
- create/edit/publish workflows;
- uploads;
- dynamic tags and relationships;
- Project and News detail templates;
- analytics and statistics.
