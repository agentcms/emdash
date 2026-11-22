---
"emdash": minor
"@emdash-cms/admin": minor
---

Adds entry counts to the content-list locale switcher on multilingual sites, so editors can see how many entries each locale holds (for example `IT (4)`) before switching. The counts include drafts, scheduled and published entries and exclude the trash.

The counts come from the new `GET /_emdash/api/content/{collection}/locale-counts` endpoint, which returns `{ counts, total }` and requires the `content:read_drafts` permission.
