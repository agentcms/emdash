---
title: Show entry counts per locale and an "All locales" view in the content list
type: feature-plan
status: proposed
authors:
  - Christoph Richter (@piffie)
discussion: null
created: 2026-11-22
---

# Show entry counts per locale and an "All locales" view in the content list

## Problem and user case

File references below are to tag `emdash@1.5.0` (549c6b5); the cited lines are unchanged on main at a54f347.

With i18n enabled, a collection's content list shows one locale at a time and opens on the instance default locale (`packages/admin/src/router.tsx`, `ContentListPage`: `activeLocale = localeParam ?? i18n.defaultLocale`). Nothing on the screen says how many entries exist in the other locales.

We run one instance for several sites. Its default locale is `en`, which most sites use. One site publishes per market (`de-at`, `en-at`, `it-it`), and none of its entries are in `en`. Its owner opened the collection, saw "No entries yet" and concluded the agents had not written anything. The entries were there; he had to find the small locale switcher and try each locale in turn.

The REST API already does what he wanted: `GET /_emdash/api/content/{collection}` without `locale` returns every locale (`packages/admin/src/lib/api/content.ts`, `fetchContentList`: `if (options?.locale) params.set("locale", …)`). `LocaleSwitcher` already has a `showAll` prop that renders an "All locales" option with value `""` (`packages/admin/src/components/LocaleSwitcher.tsx`), but the option is unreachable: no caller passes `showAll`, the content list renders the switcher only while `activeLocale` is set (`ContentList.tsx`: `i18n && activeLocale && onLocaleChange`), and the route turns a missing locale back into the default (`activeLocale = localeParam ?? i18n.defaultLocale`). Even if the option were shown, choosing it would navigate to `locale: undefined` and land on the default locale again. This plan makes the existing option reachable instead of adding a new control.

## Proposed behavior

Two parts. Each is useful alone and can ship as its own pull request; part 1 is the smaller one.

### 1. Entry counts per locale in the switcher

The content-list locale switcher labels each locale with its number of entries in this collection, for example `DE-AT (3)`, `EN (0)`. The counts cover the entries the list would show with no other filter (not trashed). An empty-looking list then explains itself: the user sees at once that the entries are in another locale.

This alone would have prevented our confusion. It costs one grouped count query per collection view, `SELECT locale, COUNT(*) … WHERE type = ? AND deleted_at IS NULL GROUP BY locale`, next to the existing `count`/`getStats` queries in `packages/core/src/database/repositories/content.ts`. Exposed either as an optional `localeCounts` field on the list response (computed only for the first page) or as a small `GET /_emdash/api/content/{collection}/locale-counts` route. The counts load with the list and do not block it; while they load the switcher shows plain codes.

### 2. "All locales"

- The switcher offers "All locales" first (the existing `showAll` option). Choosing it lists the entries of every locale; the API call omits `locale`.
- In that mode each row shows its locale. The list already renders a `LocaleChip` per row when i18n is on (`ContentList.tsx`, `showLocale`), and `locale` is already a sort field.
- URL: the choice is stored in the search parameter `locale`. A specific locale is `?locale=de-at`, as today. All locales needs an explicit value that survives a reload and a shared link; we propose `?locale=all` (an empty value is dropped by the router: `handleLocaleChange` passes `locale || undefined`). `all` is not a valid BCP 47 primary subtag in practice but it does match `LOCALE_CODE_PATTERN`, so the value must be reserved; see open questions.
- Default: unchanged. Without `locale` the list still opens on the default locale. An optional per-collection default (see open questions) is a separate decision.
- "New entry" from the all-locales view creates in the instance default locale, as it does when no locale is given today (`resolveContentCreateLocale`). The button must not pass an empty or `all` locale (`ContentList.tsx` passes `search={{ locale: activeLocale }}` to `/content/$collection/new`).
- Sorting and paging work as for one locale: the list API already sorts and pages across locales when `locale` is absent.

## Goals

- A user can see that a collection has entries without guessing which locale they are in.
- A user can list all entries of a collection regardless of locale, from the switcher, with a URL that keeps that view.
- No change for sites without i18n, and no change to what the list shows by default.

## Non-goals

- Changing the default locale of the content list, or adding a per-collection default locale (open question; it touches the manifest and collection schema).
- An "All locales" view in other locale-scoped screens (taxonomies, bylines, menus).
- Translation management (for example a "missing translations" view).
- Counts by status per locale. The status filter already exists; a count per locale is enough to find entries.

## Interfaces and compatibility

- **REST API:** part 1 adds either an optional `localeCounts` object to the list response (`{ "de-at": 3, "en": 0 }`) or a new read-only route. Part 2 needs no API change.
- **Admin search parameter:** `locale=all` gains a meaning in the content list route (`validateSearch` in `router.tsx`). Today any string is passed through as a locale.
- **Stored data, migrations, configuration, plugin surface:** none.
- Plugins that render list columns (`ExtensionColumnHeader`, row extensions) receive `locale` today; in the all-locales view they must receive `undefined`, not `""` or `"all"`.

## Errors and edge cases

- **Bulk actions** (publish, unpublish, delete) act on selected rows by id and work across locales. **Bulk tag** resolves terms in one locale (`BulkTagDialog.tsx`: `termLocale = activeLocale ?? defaultLocale ?? "en"`); in the all-locales view it must use each entry's own locale, or be disabled with a reason. We propose disabling it there for a first version.
- **Term filters** are locale-scoped by design (proposals/content-list-term-filters.md, accepted, not yet implemented at 1.5.0: "With i18n on, the list shows one locale"; the picker loads the list locale's terms plus default-locale fallbacks). In the all-locales view the picker would load default-locale terms only, while matching through translation groups still works for every locale. Either accept that (and say so in the picker) or hide term filters in that view. This plan proposes hiding them, so no filter offers terms that silently miss entries. Whichever lands second must handle the combination.
- **Translation groups:** each locale variant is its own row, as today. No grouping or de-duplication.
- **Search, status, author, byline and date filters** are not locale-scoped and combine with all locales unchanged.
- **Selection** is scoped by locale today (`selectionScope` includes `activeLocale`); switching to or from all locales clears it, as switching locale does now.
- **Counts:** they are a hint, not a guarantee; they can be stale between refetches. A count of 0 next to the active locale with entries elsewhere is the case this feature exists for.
- **Large collections:** the grouped count runs once per list view, not per page; its cost on large D1 tables should be measured (rows read) like the term-filter plan does.

## Verification

- Admin component tests (`packages/admin/tests/components/ContentList.test.tsx`): the switcher shows "All locales" and counts when i18n is on and nothing new when it is off; choosing "All locales" calls `fetchContentList` without `locale`; the row locale chip is shown; "New entry" from that view navigates without `locale`; bulk tag and term filters are not offered there.
- Router test: `?locale=all` survives a reload and selects the all-locales view; `?locale=de-at` behaves as today; no `locale` opens the default locale.
- Repository/handler tests for the grouped count: counts per locale, trashed entries excluded, a locale with no entries reported as 0 when it is configured.
- Manual verification on a site with two locales and entries only in the non-default one: the switcher shows the counts, "All locales" lists the entries, a reload keeps the view.

## Prototype

A working implementation exists, as evidence that the plan is small and fits the existing code. It is in the fork `agentcms/emdash`, branch `mc2/content-list-locales`, as two commits on top of tag `emdash@1.5.0`, one per part, so each could become its own implementation PR once this plan is accepted:

1. `feat: show entry counts in the content-list locale switcher`: a `GET /_emdash/api/content/{collection}/locale-counts` route (`content:read_drafts`, one `GROUP BY locale` query, admin only, so no logged-out query is added), handler, repository method, OpenAPI entry and REST reference row; `LocaleSwitcher` gains an optional `counts` prop. About 285 added lines, most of them tests.
2. `feat(admin): add an "All locales" choice to the content-list locale switcher`: `ContentList` gains an opt-in `showAllLocales` prop and passes `showAll` to the existing switcher; the route maps `?locale=all` to "no locale" (unless a configured locale is literally `all`); "Add New" and "Create your first one" use the default locale; bulk tag is hidden. It also corrects a sentence in the i18n guide, which says a list request without `locale` uses the default locale, while the handler returns every locale (now covered by a test). About 220 added lines, most of them tests.

The prototype chose the separate route over a list-response field (the counts then do not depend on page, filters or cursor, and cache independently), and `?locale=all` with a guard for a configured `all` locale instead of reserving the code. Its tests: core integration tests for the counts and the no-locale list on SQLite (the PostgreSQL variants were not run), and admin browser tests for the switcher labels, the "All locales" choice, URL persistence, the list request without `locale`, the default-locale "Add New" link and the `all`-locale guard. Our own instance has run on this build since 22 November 2026.

## Open questions

- Value for "all" in the URL: `all` (reserved, cannot be a configured locale) or a separate parameter such as `?allLocales=1`.
- Per-collection default locale for the content list (for example from a collection setting), as a later, separate plan.
- Counts on the list response versus a separate route (the prototype uses a route).
