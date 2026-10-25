"""Rebuild the artworks page around what is actually true.

The page used to present twenty AI images as a programme: stop numbers, canal names,
each work "standing" at a coordinate, plus departure docks. The 2026/27 line-up and route
are unpublished, so every one of those specifics was invented — and now that real offers
sit next to them, invented specifics read as deception.

What the page says instead:
  * each card is an illustration with a name and an "AI illustration" label — nothing else;
  * the map carries question marks instead of numbers, they shuffle on purpose, and the
    note says why: the route is not published yet;
  * the only claim on the page is the one that is true — the works will stand on the
    canals, and the boats sail through the middle of it.

Idempotent: re-run after any data change. Reads site/js/data.js, rewrites site/artworks.html.
"""
import json, os, re

SITE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "site")
PAGE = os.path.join(SITE, "artworks.html")
DATA = os.path.join(SITE, "js", "data.js")

TONES = {"sky", "amber", "magenta", "mint"}


def esc(s):
    return (str(s).replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))


def load():
    txt = open(DATA, encoding="utf-8").read()
    data = json.loads(txt.split("window.ALF_DATA = ", 1)[1].rstrip().rstrip(";"))
    return data["artworks"]


def card(w, i):
    tone = w.get("tone") if w.get("tone") in TONES else "sky"
    img = w["image"].split("/")[-1]
    mirror = i % 2 == 1
    img_col = "md:col-span-7 md:order-2" if mirror else "md:col-span-7"
    txt_col = "md:col-span-5 md:order-1" if mirror else "md:col-span-5"
    return (
        '<article id="stop-%d" class="reveal scroll-mt-28 grid items-center gap-8 md:grid-cols-12 md:gap-14">'
        '<div class="%s"><div class="duotone bg-%s aspect-4/3 w-full">'
        '<img alt="%s — AI illustration" loading="lazy" src="images/%s">'
        '<div class="duotone-floor"></div></div></div>'
        '<div class="%s"><span class="label-xs border-2 border-paper/25 px-3 py-2 text-paper/70">AI illustration</span>'
        '<h3 class="headline mt-5 text-3xl md:text-4xl">%s</h3>'
        '<p class="mt-5 text-sm uppercase tracking-[0.16em] text-paper/45">Made for this guide — not a photograph, not a position</p>'
        '</div></article>'
    ) % (w["id"], img_col, tone, esc(w["title"]), img, txt_col, esc(w["title"]))


def build_map_section(works):
    names = "".join(
        '<button type="button" data-goto="stop-%d" class="flex w-full items-center gap-3 border-l-2 border-paper/15 px-3 py-2.5 text-left transition-colors hover:border-mint hover:bg-paper/5">'
        '<span class="min-w-0"><span class="block truncate text-sm font-semibold text-paper">%s</span>'
        '<span class="block truncate text-[11px] uppercase tracking-[0.14em] text-paper/45">AI illustration</span></span></button>'
        % (w["id"], esc(w["title"]))
        for w in works
    )
    return (
        '<section id="map" class="scroll-mt-20 bg-night px-5 py-20 md:px-8 md:py-24"><div class="mx-auto max-w-[1500px]">'
        '<div class="reveal flex flex-wrap items-end justify-between gap-6"><div>'
        '<p class="label-xs text-magenta">The route</p>'
        '<h2 class="headline section-type mt-5">Where the works will stand</h2></div>'
        '<p class="max-w-sm text-sm text-paper/55">Not published yet. The festival reveals the route and the positions of the works closer to the opening — until then these markers are honest placeholders, and they move on purpose.</p>'
        '</div>'
        '<div class="reveal mt-10 grid gap-6 lg:grid-cols-12">'
        '<div class="border-2 border-paper/15 lg:col-span-9"><div class="relative">'
        '<div class="alf-map h-[420px] w-full bg-deep md:h-[560px]" role="application" aria-label="Placeholder map — the 2026/27 route is not published"></div>'
        '<div class="pointer-events-none absolute left-4 top-4 z-[500] flex flex-col gap-2 text-[11px] font-bold uppercase tracking-[0.14em]">'
        '<span class="flex items-center gap-2 bg-night/85 px-3 py-2 text-paper/80 backdrop-blur-sm"><span class="alf-legend-unknown"></span> Position not yet published</span>'
        '</div>'
        '<p class="absolute bottom-4 left-4 right-4 z-[500] bg-night/85 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-paper/70 backdrop-blur-sm">Placeholders — they shuffle on purpose. No real position is shown here.</p>'
        '</div></div>'
        '<div class="lg:col-span-3"><p class="label-xs text-paper/45">Our illustrations</p>'
        '<div class="mt-4 grid gap-1 lg:max-h-[512px] lg:overflow-y-auto lg:pr-1">%s</div>'
        '</div></div></div></section>'
    ) % names


def main():
    works = load()
    h = open(PAGE, encoding="utf-8").read()
    before = h

    # ---- hero: no "2026 edition" route claim
    h = h.replace(
        '<p class="rise rise-3 mt-8 max-w-2xl text-lg leading-relaxed text-paper/80">Every work stands on the water, a bridge or a quay of the old centre. Walking the route is free; the boats sail straight through the middle of it.</p>',
        '<p class="rise rise-3 mt-8 max-w-2xl text-lg leading-relaxed text-paper/80">The works stand on the water, on bridges and along the quays of the old centre, and walking will be free. The 2026/27 positions are not published yet, so everything on this page is an illustration made for this guide &mdash; and the map is deliberately unanswered.</p>')

    # ---- map section: replace wholesale
    i = h.find('<section id="map"')
    j = h.find('</section>', i) + len('</section>')
    assert i > 0 and j > i, "map section not found"
    h = h[:i] + build_map_section(works) + h[j:]

    # ---- grid: chips out, note in, cards rebuilt
    i = h.find('<div class="reveal flex flex-wrap gap-3 border-y border-paper/15 py-6">')
    j = h.find('</div>', i) + len('</div>')
    assert i > 0 and j > i, "chip row not found"
    note = (
        '<div class="reveal flex flex-wrap items-center gap-x-6 gap-y-2 border-y border-paper/15 py-6">'
        '<span class="label-xs text-paper/55">%d illustrations</span>'
        '<span class="label-xs text-paper/45">AI-generated, named by us</span>'
        '<span class="label-xs text-paper/45">Not the festival&rsquo;s works &mdash; the real line-up is announced by the festival</span>'
        '<span class="label-xs ml-auto text-paper/45"><a class="underline decoration-dotted hover:text-paper" href="https://amsterdamlightfestival.com/en/" target="_blank" rel="noopener">official programme</a></span>'
        '</div>'
    ) % len(works)
    h = h[:i] + note + h[j:]

    for i, w in enumerate(works):
        m = re.search(r'<article id="stop-%d".*?</article>' % w["id"], h, re.S)
        if not m:
            print(f"  !! card {w['id']} not found")
            continue
        h = h.replace(m.group(0), card(w, i))

    open(PAGE, "w", encoding="utf-8", newline="").write(h)
    print(f"artworks.html rebuilt: {len(before):,} -> {len(h):,} bytes, {len(works)} cards")


if __name__ == "__main__":
    main()
