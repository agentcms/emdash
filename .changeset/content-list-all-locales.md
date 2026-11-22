---
"@emdash-cms/admin": minor
---

Adds an **All locales** choice to the content-list locale switcher on multilingual sites. It lists the entries of every locale in one table, with each entry's locale in the locale column, and keeps the choice in the URL as `?locale=all`. The list still opens on the default locale.

While all locales are listed, **Add New** creates the entry in the default locale and bulk tagging is unavailable, because taxonomy terms belong to one locale. If a site configures a locale with the code `all`, `?locale=all` keeps filtering to that locale.
