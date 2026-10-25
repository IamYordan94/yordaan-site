# Amsterdam Light Festival — website

**Live: https://iamyordan94.github.io/amsterdam-light-festival/**

A complete, self-contained copy of the festival website: 4 pages, all images, all styling.
No build step, no accounts, no dependencies to install. It is plain HTML, CSS and JavaScript,
so any free static host can serve it and it also opens straight from your own computer.

## The pages

| File | What it is |
|---|---|
| `index.html` | Home page (hero, ticker, artwork carousel, FAQ, contact) |
| `artworks.html` | All works + the real map (OpenStreetMap) |
| `tickets.html` | The 4-step booking flow |
| `ticket.html` | The confirmation page that a finished booking lands on |

## See it on your own computer

Double-click **`start-website.cmd`**. It starts a tiny local web server and opens the site in
your browser at `http://127.0.0.1:8099/`.

You can also simply double-click `index.html` — everything works except that the map needs the
local server (a browser security rule blocks map data when opened as a plain file).

## Put it online for free

**Netlify Drop** (easiest, no account needed to try):
1. Go to <https://app.netlify.com/drop>
2. Drag this whole folder onto the page
3. You get a live address in about ten seconds

The included `_redirects` file makes the tidy addresses work
(`/artworks`, `/tickets`, `/ticket/ALF-XXXXXX`), so no extra setup is needed.
Cloudflare Pages, GitHub Pages and Vercel all work the same way — drag the folder, done.

## Changing what the site shows

| What you want to change | Where |
|---|---|
| Artworks (titles, artists, descriptions, map points, photos) | `js/data.js` → `artworks` |
| Boats, prices, docks, time slots, add-ons, sale dates | `js/data.js` → `cruises` |
| Page text and layout | the `.html` files (the text is right there in the markup) |
| Colours, fonts, sizes | `css/style.css` |
| Photographs | drop a new file into `images/` and point to it in `js/data.js` |

`js/data.js` is the single place the site reads its content from — edit it with any text editor.

## What is simulated (on purpose)

The original site talked to a booking server. This copy has no server, so it reproduces that
behaviour in the browser:

- **Seat numbers** are calculated from the date, time and boat, so they stay steady when you
  refresh — the same way a real availability system behaves. They are made-up numbers.
- **A finished booking** is stored in the browser (localStorage) and shown on the confirmation
  page. Nobody is emailed, no payment is taken, nothing leaves the device.
- **The newsletter and contact forms** are deliberately inert, exactly like the original demo.

When you want real bookings, the honest path is a small backend (a form service or a booking
API) wired into `js/tickets.js` — the rest of the site does not have to change.

## Files

```
index.html  artworks.html  tickets.html  ticket.html
css/style.css      the design system (compiled from the original)
css/site.css       small additions
js/data.js         all content/data
js/main.js         header, scroll reveals, artwork carousel, FAQ
js/artworks.js     filters, stop list, map
js/tickets.js      the booking flow
js/ticket.js       confirmation page
images/            photographs and the favicon
vendor/leaflet/    the map library (bundled locally so nothing depends on a CDN)
```
