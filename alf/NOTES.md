# Build notes — how this copy was made

*For whoever picks this up next (agent or human).*

## Where it came from

The published site was a **Vite + React single-page app** on `lightfestival.runable.site`.
Every route served one shell, so the content came from three places:

1. **Rendered DOM** — the live pages were rendered in headless Chrome and dumped
   (`raw/*.rendered.html`). That gave the exact markup, including the compiled Tailwind
   class strings, so the rebuild reuses the site's own class vocabulary.
2. **The production bundle** — `raw/app.js` (beautified to `raw/app.pretty.js`) held all the
   copy, the wizard logic, the icon paths and the animation constants.
3. **The app's own JSON API** — a `POST https://<host>/api/rpc/<procedure>` endpoint
   (`{"json":{}}`), discovered in the bundle. Pulled: `artworks/list`, `cruises/options`,
   `cruises/availability`, `cruises/seatsLeft`, `bookings/quote`. The result was baked into
   `js/data.js` so the finished site needs no server.
4. **The compiled stylesheet** — `css/style.css` is the original `index-*.css`, untouched.

`bookings/create` was never called (it writes to a live database).

## Build tooling (lives outside this folder)

`C:\Users\veria\lightfestival-crawl\`

| File | Purpose |
|---|---|
| `extract_pages.py` | Rebuilds `index.html`, `artworks.html`, `tickets.html` from the rendered DOMs (rewrites links, strips the host's badge, empties the map container) |
| `build_ticket_page.py` | Builds `ticket.html` from the shared header/footer + the confirmation markup |
| `make_data.py` | Bakes the API JSON into `js/data.js` |
| `cdp.js` | Headless-Chrome driver (navigate + evaluate + screenshot) used for testing |
| `specs/*.md` | Page-by-page extraction specs from the bundle |

## How it was verified

* Element-by-element geometry compared against the live original (`scrollHeight` and the
  top/height of every section and article): **identical**.
* Pixel diff of full-page screenshots: home **0.08%**, artworks **0.38%**, tickets **0.38%**,
  mobile home **0.22%**. The residue is the host's removed badge, the animated sponsor
  marquee's phase, and sub-pixel text anti-aliasing.
* The map was compared live: same container size, same tiles, same 12 pin positions, same
  4 docks, same attribution.
* The booking flow was driven end-to-end in a real browser: date → boat → time → dock →
  guests → details → confirm → reference → confirmation page, including validation errors,
  the pending state and the price arithmetic (€158.95 for 2 adults + 1 child + salon boat +
  blanket + audio guide + booking fee).
* Seat-colour rules, step-bar states, summary rows and date/price formatting were compared
  field-by-field against the live original — identical output.

## Deliberate differences from the original

1. The "Made with Runable" badge is removed (it was the host's, injected by their script).
2. Bookings live in `localStorage` instead of a server database; seat counts are generated
   deterministically from date + time + boat.
3. Links are flat (`artworks.html`, `tickets.html`) with a `_redirects` file so the tidy
   addresses (`/artworks`, `/ticket/ALF-XXXXXX`) still work on Netlify-style hosts.
4. Leaflet is vendored in `vendor/leaflet/` rather than loaded from a CDN.
5. The stale `<meta name="description">` was kept exactly as the original had it
   (it says "15 January – 22 February" while the site says 26 Nov – 17 Jan). Worth fixing —
   it is only what search engines and link previews read.
