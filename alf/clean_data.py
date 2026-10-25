"""Keep only what is true.

The first build of this site invented boat prices, departure docks, route names and
per-artwork locations so the pages would look complete. They now sit next to real offers
from Viator and GetYourGuide, and mixing invented specifics with real ones is the one
thing a visitor cannot forgive — and reads as deception.

This script decides the shape of the published data:

  artworks  ->  our AI illustration: id, title, image, tone. No locations, no kinds,
                no stop numbers, no descriptions (the 2026/27 line-up is unpublished).
  cruises   ->  one entry per real boat type: code + plain-language label.
                Everything inside "affiliate.options" is real and stays: it comes from
                the platforms' own APIs and pages.

Idempotent: run it after any sync. It is also called by daily_refresh.py.
"""
import json

DATA = "site/js/data.js"
KEEP_WORK = ("id", "title", "image", "tone")


def clean(path=DATA):
    src = open(path, encoding="utf-8").read()
    head, payload = src.split("window.ALF_DATA = ", 1)
    d = json.loads(payload.rstrip().rstrip(";"))

    before = json.dumps(d)
    works = []
    for a in d.get("artworks", []):
        w = {}
        for k in KEEP_WORK:
            if a.get(k) is not None:
                w[k] = a[k]
        w.setdefault("tone", "sky")
        works.append(w)
    d["artworks"] = works

    cruises = d.get("cruises") or {}
    label = {
        "open": "Open boat",
        "covered": "Covered, glass-roof boat",
        "salon": "Historic salon boat",
    }
    cruises["boats"] = [
        {
            "code": b.get("code"),
            "label": label.get(b.get("code")) or b.get("kind") or b.get("name"),
            # the offers are real data from the platforms — they are the point of the site
            "affiliate": b.get("affiliate") or {"options": []},
        }
        for b in cruises.get("boats", [])
    ]
    cruises.pop("docks", None)
    cruises.pop("partners", None)
    d["cruises"] = cruises

    after = json.dumps(d)
    if before != after:
        open(path, "w", encoding="utf-8").write(
            head + "window.ALF_DATA = " + json.dumps(d, ensure_ascii=False, indent=1) + ";\n"
        )
        print(f"cleaned {path}: {len(works)} illustrations, {len(cruises['boats'])} boat types")
    else:
        print(f"{path}: already clean")
    return d


if __name__ == "__main__":
    clean()
