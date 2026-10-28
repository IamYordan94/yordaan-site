# RECOVERY — yordaan.com

What this is: the one page to read if this laptop dies, or if you come back in
six months and cannot remember how any of it works. No secrets are written here —
only names of settings. The values live in the password manager / the platform.

**Do not leave this file only on the laptop.** That is the thing it protects
against. It must be committed and pushed.

---

## What is live, and where

| Thing | Where it runs | Built from |
|---|---|---|
| `yordaan.com` (root) | Cloudflare Pages | this repo, `main` |
| `yordaan.com/alf/` (Light Festival affiliate guide) | Cloudflare Pages | this repo, `main` — **see the duplicate below** |
| Git history | `github.com/IamYordan94/yordaan-site` | — |

The root is the **Yordan Creatives** studio site. The **Amsterdam Light Festival
affiliate guide lives under `/alf/`**, not at the root. That move happened on
2026-10-27; anything older that says the guide is at the root is out of date.

## The duplicate that will bite you

The guide's files exist in **two** folders, with identical content:

- `C:\Users\veria\yordaan-site-work\alf\`  ← this repo
- `C:\Users\veria\lightfestival-crawl\_yordaan\`  ← the older `money-kit` repo

The daily offer refresh (`lightfestival-crawl\daily_refresh.py`, cron 07:30)
writes into the **money-kit** copy. If you edit the copy in this repo and the
refresh does not know about it, you will change a file, deploy, and see "nothing
happened". Before editing `alf/`, check both copies. Long term: keep one.

## What is lost if this laptop dies

| Lost | Where it is recoverable from |
|---|---|
| The site itself + history | GitHub (`yordaan-site`) — survives |
| The `.env` / API keys | **Nowhere, unless the off-site bundle ran.** See `C:\Users\veria\fleet\README.md` → off-site backup |
| Affiliate product data | `alf/js/data.js` is committed — survives |
| The Cloudflare project settings | Cloudflare dashboard (account login) |
| The domain registration | Registrar account — **name the registrar and keep the renewal date here** |

## Outside accounts this depends on

- **Cloudflare** — hosts the site and the DNS. Settings needed by name only:
  Pages project, custom domain `yordaan.com`, TLS mode.
- **GitHub** — `IamYordan94/yordaan-site`, `main` is the deploy branch.
- **Vercel** — not used for this domain (other projects only).
- **Affiliate networks** — Viator (affiliate id `P00296752`), GetYourGuide
  (partner id `KRAI3FK`). Both ids are embedded in `alf/js/data.js`, so the
  income path is visible in the repo.

## Things that must stay true (the daily check asserts these)

1. `https://yordaan.com/alf/` returns 200 and contains "Amsterdam Light Festival".
2. `https://yordaan.com/alf/js/data.js` carries ≥3 `P00296752` and ≥3 `KRAI3FK` tags.
3. `https://yordaan.com/robots.txt` must **not** contain `Disallow: /alf/` —
   otherwise the guide is invisible to search engines, which is where the income
   comes from.
4. `https://yordaan.com/` returns 200 and contains "Yordan Creatives".
5. The live `alf/js/data.js` is byte-identical (ignoring line endings) to the
   copy on this machine — this is how a broken publish is detected.

## Rebuild from nothing

1. Install git, Node, Python.
2. `git clone https://github.com/IamYordan94/yordaan-site.git yordaan-site-work`
3. Restore the `.env` files from the encrypted off-site bundle
   (`fleet/restore_offsite.sh --from-server`), or from the password manager.
4. Connect the repo to a new Cloudflare Pages project, build output = repo root,
   custom domain `yordaan.com`.
5. Re-create the daily refresh: `lightfestival-crawl/daily_refresh.py` on cron at
   07:30, and point its `DEPLOY` path at whichever repo actually deploys.
6. Re-enable the checks: this site is monitored by `C:\Users\veria\fleet`
   (`projects\yordaan.json`), which runs daily at 07:00.

## Last verified

2026-10-28 — all five assertions above checked by `fleet.py`, plus TLS (89 days).
At that time `robots.txt` still contained `Disallow: /alf/` in production; the fix
is in this working tree and deploys with the next push.
