# Agency customer site — user stories

Black-box stories for the public marketing site at `localhost:3100`.
Each story maps 1:1 to one or more `*.spec.ts` files in this directory.

## Visitor — landing & first impression

**S1. Visitor lands on `/` and sees the value prop above the fold.**
The hero shows a "Available for new work · YYYY" pill, a display headline,
a one-paragraph subhead, and two CTAs ("Start a project" → `/contact`,
"See our work" → `/work`).

**S2. Visitor scrolls and sees every section without animation flicker.**
Below the hero: recognitions row, practices grid (6 items), case studies
(4 tiles with images), stats (4 numerals), closing sign-off.

**S3. Visitor can scan the practices the studio offers.**
Six labelled cards rendering the seeded entries.

**S4. Visitor can see proof-of-work via case study tiles.**
Tiles render `client / industry / year` metadata, a headline, and a hero
image. Each tile links to its case study detail page.

## Visitor — exploring work

**S5. Visitor opens `/work` and sees every published case study.**
Hero with mono pill, "Recent projects, shipped." headline. Card grid below
shows one card per published case study.

**S6. Visitor filters work by industry and the URL reflects it.**
Clicking an industry chip narrows the grid to matching studies. The URL
includes `?industry=…`. The "All" chip resets.

**S7. Visitor opens a case study and reads the story.**
`/work/<slug>` renders the metadata pill, headline, summary, hero image,
body paragraphs, results grid, and a closing CTA. JSON-LD `Article`
schema is in the head.

**S8. Visitor returns to the work index via "← All work".**
The back link on the case study detail navigates to `/work`.

## Visitor — marketing pages

**S9. Visitor opens `/about`, `/services`, `/contact` and pages render.**
Each catch-all marketing page returns 200 and shows its hero +
configured sections (no 500s, no blank sections).

**S10. Visitor visits `/contact` and sees the contact placeholder form.**
The form (name, email, message) renders with a disabled submit state and
a helper note explaining submissions aren't wired up yet. Page does not
500.

## Visitor — navigation

**S11. Visitor uses the primary nav to move between pages.**
Header links (Services / Work / About / Contact) navigate without
client-side errors. The brand mark links to `/`.

**S12. Visitor finds contact info in the footer.**
The footer shows the brand block, contact email link, and on every page
a non-empty Contact column with at least the email.

**S13. Visitor visits a non-existent page and gets a clear 404.**
A request to a page that does not exist returns HTTP 404 and a
"Page not found" message.

## Resilience

**S14. No console errors on any public route.**
Loading `/`, `/work`, `/work/<seeded-slug>`, `/about`, `/services`,
`/contact` produces no `console.error` entries.

**S15. The light theme is applied regardless of OS preference.**
The body computed background-color stays near-white even when the
browser emulates `prefers-color-scheme: dark`.
