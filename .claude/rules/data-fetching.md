## Data Fetching Rules

These rules are **strict**. Violations are not "we can fix it later" — they are blocking review feedback. Code that follows the patterns prohibited below MUST NOT be merged, even as a stop-gap. Pattern matters more than current data volume; what works at 100 rows silently breaks at 10,000 with no error and no log line.

### Why these rules exist

A list endpoint is a contract about scale. The moment a frontend pulls a "big enough" page and joins or filters in JavaScript, the contract is broken — the system has a hidden ceiling that nothing in the code, types, or tests reveals. The first time it's exceeded, rows simply disappear from the UI. By the time someone notices, dashboards have been wrong for weeks. This is the worst class of bug: silent, gradual, and invisible to monitoring.

The fix is not "raise the limit." The fix is to push filtering, sorting, joining, and pagination to the server, where the database can answer the actual question instead of shipping its entire table to the browser to be re-asked.

### Hard prohibitions

The following are NEVER acceptable, regardless of "current" data size, "internal tool" status, "MVP" framing, or "we'll fix it after launch":

1. **No arbitrary high `limit=` to side-step pagination.** `limit=1000`, `limit=10000`, `pageSize: 99999` — none of these are acceptable. There is no "safe" magic number. If a screen needs more than one page of data, the screen is wrong, not the limit. Use server-side filters + pagination, or a dedicated aggregation endpoint, or change the UX.

2. **No client-side joins across multiple list endpoints.** Fetching `/widgets`, `/widget-types`, and `/users` in parallel and stitching them with `Map.get(id)` in a `useMemo` is forbidden. Each of those calls has its own pagination ceiling, and the join is O(N) per render against the network. If a view needs joined data, the join happens on the server: either as embedded display columns in the list response (`clientName`, `lawCode`) or via a dedicated read-projection endpoint (`/foo/list-view`).

3. **No client-side derivation of stateful filters.** Categories like "overdue", "due this week", "stale", "needs review" — anything computed from `dueDate < today AND completedAt IS NULL` — must be expressible as a server-side filter. The widget asks `?dueBefore=2026-04-30&notCompleted=true&limit=5`; it does not pull "everything" and call `.filter(r => r.status === 'overdue')`.

4. **No "it works for now" reasoning.** A comment, commit message, or PR description containing "should be enough for now", "we don't have many X yet", "low traffic so this is fine", or "we'll paginate later" is itself a violation. Either the code is correct at any plausible scale, or it doesn't merge. Future-you will not remember to come back. Future-you will be paged.

5. **No silent truncation.** If a list response is paginated, the consuming code MUST check `meta.total` and either render a "View all N" affordance or surface the truncation. A widget that displays 5 of an unknown total without indicating there's more is hiding data.

### Required patterns

When a screen needs data:

- **Filtering, sorting, and pagination are server-side.** The list endpoint accepts the filter primitives the UI actually uses (`status`, `dueBefore`, `assigneeId`, `clientId`, `q`) and a `sort` parameter. The frontend translates UI controls into query params, never into in-memory `.filter()` chains over the full table.

- **Display joins are server-side.** If a row needs `clientName` next to `clientId`, the server returns `clientName` in the row. Do not pull `/clients?limit=1000` to look up names. Either embed denormalised display columns in the list response, or expose an `?include=client,law` parameter, or build a dedicated read-projection endpoint for the screen. The choice between these is a design decision — present options and ask. But "client-side join" is not on the menu.

- **Hooks are narrow.** A dashboard widget that shows "5 most overdue filings" gets a hook `useOverdueFilings({ limit: 5 })` that hits a filtered endpoint. It does not import a generic `useEverything()` hook and `.slice(0, 5)` the result. The hook's name and signature should reflect the question the widget is asking.

- **Counts come from the server.** "View all 47 overdue" — the 47 comes from `meta.total` on a filtered query, not from the length of a 1000-row array.

- **Pagination is real.** Tables use server-side pagination with `page` + `limit` in the URL, sort and filter params in the URL, and round-trip on every change. `useMemo` over a fully-loaded array is not pagination.

### When the backend doesn't support what you need

This is the most common source of violations: the screen needs a filter the API doesn't expose, so someone "temporarily" pulls everything and filters in the browser. **This is the violation.** The correct response is:

1. Stop. Do not write the client-side workaround.
2. Add the filter primitive to the list endpoint (or propose a new aggregation endpoint).
3. Ship the backend change first, then wire the UI.

This produces one extra commit and one extra round of review. It does not produce a hidden scale bug.

### Aggregation and reporting

Reports, dashboards, and summary widgets often need shapes that don't fit a list endpoint at all (counts by bucket, time-series, top-N rankings). These get **dedicated aggregation endpoints** that compute on the server and return the already-aggregated shape. Never assemble a chart by pulling the underlying table client-side.

### Bounded reference data

A small, bounded reference set — a hard-capped enum-like table the product owner cannot grow past a handful of rows (currencies the app supports, hardcoded countries list, fixed role types) — MAY be fetched in full and cached. The bar is high: the cap must be **structural** (constrained by code or product design, not "small for now"), the row count must be in the low dozens at most, and the data must be effectively static within a session. If you find yourself arguing whether something qualifies, it doesn't — treat it as unbounded and follow the rules above.

### Review checklist

Before approving any frontend data-fetching code, verify:

- [ ] No `limit` value above what the screen actually needs to render.
- [ ] No `?limit=1000` (or similar) anywhere — `git grep -E 'limit=[0-9]{3,}'` returns nothing new.
- [ ] No `useQuery` whose `queryFn` fans out to N other endpoints to be joined in `useMemo`.
- [ ] No `.filter()` / `.slice()` / `.sort()` over a full-table fetch where the server could have done the work.
- [ ] Every list view paginates, sorts, and filters via URL params round-tripped to the server.
- [ ] Every "View all N" or "X of Y" indicator is fed by `meta.total`, not by client-side array length.
- [ ] Status categories derived from multiple columns (`overdue`, `due-this-week`) are expressible as server filters.
