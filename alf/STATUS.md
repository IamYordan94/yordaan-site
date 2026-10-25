# Amsterdam Light Festival — project status

**Live: https://yordaan.com/** — the domain is now this project's home; the placeholder page that was there is gone and robots.txt opens the site so it can be found.
Mirror: https://iamyordan94.github.io/amsterdam-light-festival/ — every page carries a canonical tag pointing at yordaan.com, so the mirror can never compete with the real address.
Repos: `IamYordan94/money-kit` (drives yordaan.com through Cloudflare Pages) · `IamYordan94/amsterdam-light-festival` (mirror)
Build tooling: `C:\Users\veria\lightfestival-crawl\` · Project copy: `Desktop/AI STUFF DIFFERENT AGENTS/In progress/Amsterdam Light Festival/`
Last updated: 24 Sep 2026

---

## 1. WHAT IS LIVE AND WORKING

### The site
| Page | Address | State |
|---|---|---|
| Home | https://yordaan.com/ | 20 works in the programme, all images load |
| Artworks + map | /artworks | 20 cards, 20 map pins, 4 docks, filters |
| Booking wizard | /tickets | 4 steps, offers on sliding rails, real prices and times |
| Confirmation | /ticket/ALF-XXXXXX | works; falls back to your last booking when the reference is missing |
| 404 | any bad address | custom page |

### The booking partners (this is what earns)
- **Viator** — Full Access API. 7 real offers across covered / open / salon, with real prices and departure times, every link carrying `pid=P00296752`.
- **GetYourGuide** — partner `KRAI3FK`, written into every offer URL by hand (their widget only tags `<a>` links), analytics installed.
- Every offer card has a **direct "Book on Viator / GetYourGuide" button**, so a visitor can click straight through without finishing the wizard. All verified tagged.
- Commission disclosure beside every hand-off; demo notice and "not affiliated" line in every footer.

### The programme: 20 works, no invented people
The real 15th edition (26 Nov 2026 – 17 Jan 2027) is reported by the cruise guides as **about 20 installations**; the "31" in the starter copy was never real and is gone everywhere. Each work now says what it *is* and where it stands — "Light sculpture on the water · Amstel" — instead of an artist name, because the 2026/27 programme is not published yet and no real names exist to use. The artworks page links to the official festival site for the real names when they appear. **Every invented artist name and every fake sponsor has been removed.**

### The images
All artwork images and the four scene images are AI-generated illustrations, each with its own form, placement and camera angle. Every generated picture carries a small **"AI ILLUSTRATION" mark burned into the corner**, plus the footer label on every page and the grid label on /artworks. Originals are backed up in `site/images/_originals`.

### The offer rails
The category list (step 2) and the offer list (step 3) of the wizard are both sliding rails: drag, scroll, arrow keys or the arrow buttons. Nothing moves on its own. Movement is instant rather than smooth, because a smooth scroll never runs while a tab is in the background.

### The daily job
Cron job **`3d026eb617af` — "Light Festival — daily offer + link check", every day at 07:30**, reporting to the chat in plain language. Each run:
1. re-pulls every offer from the Viator API (prices, departure times, drops dead products),
2. re-checks that every link still carries its affiliate tag,
3. publishes to yordaan.com only if something actually changed.

First run: 7 offers live, nothing changed, all links tagged.

---

## 2. WHAT IS LEFT TO BUILD

1. **GetYourGuide prices** — Viator prices come from the API; the GYG ones read "price on the page". Reading them needs a browser pass over their product pages; worth adding to the daily job once there is traffic.
2. **Traffic pages** — the funnel exists, nothing drives visitors to it yet. Festival searches spike from late November, so the pages that answer them (prices, route, with children, which dock) should exist before then.
3. **A sitemap.xml** plus a link from anywhere else you control — the domain is now indexable, so hand search engines the list of pages.
4. **The GitHub Pages mirror** — harmless (canonical tags), but it is a second copy to keep in step. Retire it when you feel like it.

---

## 3. YOUR TASKS

### Rotate the keys (both passed through chat — treat them as spent)

| Key | Where to get a new one | Where it lives on this machine |
|---|---|---|
| **Viator** — delete the old key, create a new one | https://partners.viator.com → Developer API → API Keys (https://partners.viator.com/developer-api/keys) | `C:\Users\veria\AppData\Local\hermes\viator.env` → `VIATOR_API_KEY_PRODUCTION=` |
| **GetYourGuide 2FA backup codes** — regenerate | https://partner.getyourguide.com → Account → Security → two-factor → regenerate backup codes | `C:\Users\veria\AppData\Local\hermes\getyourguide.env` → `GYG_2FA_BACKUP_CODE=` (partner id already stored: `GYG_PARTNER_ID=KRAI3FK`) |

### Optional

| Key | Where to get it | Where it lives |
|---|---|---|
| **OpenRouter** (image generation — the one that actually works, about $0.10 an image) | https://openrouter.ai/keys → create key; credits at https://openrouter.ai/credits | `C:\Users\veria\AppData\Local\hermes\.env` → `OPENROUTER_API_KEY=` |
| **OpenAI** (optional: the key is valid but has no credit — every call returns "no credits remaining") | key: https://platform.openai.com/api-keys · credit: https://platform.openai.com/settings/organization/billing (minimum $5) | `C:\Users\veria\AppData\Local\hermes\.env` → `OPENAI_API_KEY=` |

Nothing needs installing anywhere else: the scripts read those files directly, and GitHub is already authenticated as `IamYordan94` — that is how the site reaches yordaan.com.

### Decisions only you can make
- **KVK and a real email address**, if this is going to earn. Affiliate income is taxable, and a `.test` address reads as a warning sign.
- **Ask the festival foundation** (optional). It would upgrade the imagery from illustrations to real photographs and let you drop the "not affiliated" line — but the page does not depend on it.
- **Where the traffic comes from.** The only thing standing between this and money.

---

## 4. KNOWN LIMITS (all deliberate)

1. The programme describes 20 illustrative works, not the real 2026/27 line-up — labelled as such and linked to the official programme.
2. "6 km" of route comes from the starter copy; the festival has not published a figure. Unverified, not contradicted.
3. Prices are per person for evening departures, as the platforms list them; their own pages remain the source of truth.
4. Both platforms return 403 to automated link checks — which is why the daily job reads prices from the API and treats a 403 as normal.
5. The brand and photographs are not ours. The demo notice, the AI labels and the commission disclosure are what keep the page legitimate. Keep them.
6. **Wording now matches reality (24 Sep 2026).** The pre-affiliate copy — "Bookings are simulated,
   no payment is taken and no card details are asked for" — was left on all four pages after the
   site went affiliate-only, where the buttons do hand visitors to a real checkout. Every instance
   is corrected: the footers say nothing is sold or charged here and the payment completes on the
   operator's page, and the wizard's own copy says "They take the payment and email the tickets.
   Nothing is charged on this site."

---

## 5. QUICK REFERENCE

```bash
# preview locally
cd "Desktop/AI STUFF DIFFERENT AGENTS/In progress/Amsterdam Light Festival" && ./start-website.cmd

# refresh offers from Viator (the daily job also does this at 07:30)
cd ~/lightfestival-crawl && python3 daily_refresh.py

# images: generate, then resize + watermark + install
python3 gen_more.py
python3 install_more.py new

# rebuild pages from the artwork data
python3 build_artworks.py      # 20 works: data, cards, map list
python3 build_programme.py     # home programme section

# publish to yordaan.com (Cloudflare Pages watches the repo)
cd _yordaan && cp -r ../site/* . && git add -A && git commit -m "…" && git push
```

---

## 6. MOBILE — CHECKED, AND THREE REAL FAULTS FIXED (24 Sep 2026)

Every page was measured at **390px, 360px and 320px** wide (a normal iPhone, an older Android, a
small Android) and the booking flow was walked by *tapping* it: date → boat → cruise → guests →
hand-off. Three genuine faults turned up — none of them visible on a desktop screen:

1. **The contact email widened the page.** `hello@amsterdamlightfestival.test` is 33 characters with
   no spaces; at 320px it pushed the document 12px past the edge. Emails, phone numbers and headings
   can now break.
2. **The artwork chip row could not wrap.** Stop number + "Keizersgracht" + "On the canal wall" in one
   unbreakable row made the artworks page 17px too wide at 320px.
3. **The booking rails stretched the page.** The offer rails are horizontal scrollers, but a grid
   column defaults to `min-width:auto`, so the column was sized by the rail's whole track: step 2 ran
   **376px** too wide and step 3 **196px** too wide at 390px. The columns now shrink and the rail
   scrolls inside them.

Also: footer links and the contact details got a thumb-sized tap area, and the embedded widget was
loading lazily — on a phone it sits below the fold, so visitors would have seen an empty white frame;
it now loads with the step.

**Verified live:** all four pages and all three wizard steps fit 320/360/390px with zero overflow,
the programme index scrolls and taps select a work, the rails swipe, and the GetYourGuide module
renders on a phone (photo, tour name, rating, price, dates, traveller selector).

## 7. BOOKING SYSTEMS — WHAT IS POSSIBLE, AND WHAT WE USE

Our wizard is a **chooser**; the sale completes on the partner's site. That is not a shortcut — it is
what "affiliate" requires. Viator's own terms: *"sales of Viator products must be carried out on the
Viator site itself"*; only merchant partners, a separate agreement, may sell in their own name.

| Option | What it gives | What it needs | Verdict |
|---|---|---|---|
| Deep links + our chooser | hands a visitor over with our tag in the URL | nothing | works, but invisible |
| **Platform widgets** (live price + dates + their button, inside our page) | a real bookable module on our page, still tracked to our id | a partner account — we have one (`KRAI3FK`) | **live now** in step 3 |
| GetYourGuide API / Viator merchant | their real availability data; on GYG's Masterbill tier, bookings in our name | GYG: **100,000 visits/month** for basic, **1M + 300 bookings/month** for availability, Masterbill by contract + deposit | milestone, not a task |
| **FareHarbor Distribution Network** | links/widgets/QR for operators on FareHarbor at **15% commission** (vs ~8%) | the operator must be in the network and accept us; one affiliate agreement | **best next step** — Amsterdam Light Festival operators (Starboard Boats, Friendship Amsterdam) run on FareHarbor |
| Our own checkout (Stripe + operator contracts) | we take the money and set the margin | KVK, a contract per operator, refund liability, customer service | not before real traffic and a company |


### Where the affiliate actually shows (rewritten 1 Oct 2026)

One place now, and it is the whole booking page: **/tickets is a two-platform hub**, not a wizard.
Every Light Festival cruise we can find on either platform sits side by side, and each one takes a
visitor as far as its platform allows:

- **GetYourGuide offers embed GetYourGuide's own availability module** — their photo, their price,
  their date row, and their "Check availability" button. Picking a date there carries the date into
  their checkout, so the visitor does not re-enter anything.
- **Viator offers carry Viator's own API data** — the operator's real photo (674x446 from their CDN),
  the live "from" price, the rating and review count, the departure window, and a button straight to
  the operator's booking calendar with our tracking id.

**The wizard is gone.** It collected a date, a boat, guests, a name and an email, then handed the
visitor to a partner page where they typed all of it again. Nothing it collected could be carried
across, so it was theatre. Deleted: js/tickets.js, js/ticket.js, ticket.html.

**The home page no longer carries GetYourGuide modules** (removed 1 Oct 2026 on the client's
instruction: one platform should not get the homepage while the other gets a tab). It carries a
band linking to the hub instead.

**Module geometry, measured (important):** the GetYourGuide availability frame is a fixed-width
design. Measured across 560/576/600/620/640/700/800/916/1000/1100/1240/1400px: it stacks and
almost-fits up to ~576 (its document is always 16px wider than its window - that is their own
scrollbar gutter), and at >=600 it switches to a two-column card whose document is window+249,
i.e. it overflows badly. So it gets a **centred 560px column** on any screen wide enough, the frame
is **730px tall desktop / 870px phone** (its content measures 659 tall, so nothing scrolls inside),
and `scrolling="no"` hides their 16px gutter scrollbar. Verified live: full module visible, no
inner scrollbar, on desktop and phone.

**Viator photos must not be lazy-loaded.** With `loading="lazy"` and the cards below the fold, all
four photos measured naturalWidth 0 - never loaded, empty grey boxes. Eager: all four render.

