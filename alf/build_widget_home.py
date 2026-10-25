"""Insert (or update) the curated GetYourGuide module on the home page.

Three availability widgets, one per festival cruise we carry. Each is GetYourGuide's own
module for that single product, so it shows that cruise's real price, real dates and their
booking button, and every link carries our partner id. The multi-activity widget was
rejected: asked for our three tours it still filled a fourth cell with an unrelated tour.
"""
import re
import pathlib

SITE = pathlib.Path(__file__).parent / "site"
HOME = SITE / "index.html"
START = "<!-- curated GetYourGuide module"
END = "<!-- /curated GetYourGuide module -->"

TOURS = [
    ("507500", "Covered boat, live guide", "Amsterdam: Light Festival Cruise with Live Guide"),
    ("501688", "Unlimited drinks & snack", "Light Festival Boat with Unlimited Drinks & Snack"),
    ("501088", "Luxury, small group", "Luxury Amsterdam Light Festival Cruise with Captain Guide"),
]


def widget(tour_id: str, label: str) -> str:
    src = (
        "https://widget.getyourguide.com/default/availability.frame"
        f"?partner_id=KRAI3FK&locale=en-GB&currency=EUR&tour_id={tour_id}"
    )
    return f'''      <div class="border-2 border-paper/15 bg-[#0c1238] p-4 md:p-5">
        <p class="label-xs text-mint">{label}</p>
        <div class="mt-4 border border-paper/15 bg-white">
          <iframe src="{src}" title="Live prices and dates from GetYourGuide"
                  referrerpolicy="no-referrer-when-downgrade"
                  style="width:100%;height:592px;border:0;display:block"></iframe>
        </div>
      </div>'''


def main() -> None:
    html = HOME.read_text(encoding="utf-8")
    section = f'''{START}: three festival cruises, each one GetYourGuide's own live module -->
<section id="live-cruises" class="scroll-mt-20 border-t border-paper/12 bg-deep px-5 py-20 md:px-8 md:py-28">
  <div class="mx-auto max-w-[1500px]">
    <div class="flex flex-wrap items-end justify-between gap-x-12 gap-y-6">
      <div>
        <p class="label-xs text-mint">Live from GetYourGuide</p>
        <h2 class="headline mt-4 text-[clamp(1.7rem,4vw,2.6rem)] leading-tight">The festival cruises, and what they cost tonight</h2>
      </div>
      <p class="max-w-sm text-sm leading-relaxed text-paper/60">These are the operators' own modules: their prices, their dates, their reviews — loaded live from GetYourGuide's booking system, so they change when the operators change them. Booking and payment happen on their site; we may earn a commission, and it never changes what you pay.</p>
    </div>
    <div class="live-cruises mt-10 grid gap-5 md:grid-cols-3">
{chr(10).join(widget(t, l) for t, l, _ in TOURS)}
    </div>
    <p class="mt-6 text-xs leading-relaxed text-paper/45">Nothing on this page is a photograph of a real boat or of a real artwork: every image of the festival above and on the artworks page is an AI illustration and is labelled as one. The three modules here are the operators' own material, served by GetYourGuide.</p>
  </div>
</section>
{END}'''

    if "<!-- SLOT -->" in html:
        html = html.replace("<!-- SLOT -->", section)
        print("replaced the placeholder slot")
    elif START in html:
        html = re.sub(re.escape(START) + r".*?" + re.escape(END), section, html, flags=re.S)
        print("replaced the existing module")
    else:
        m = re.search(r'<section[^>]*>(?:(?!</section>).)*?data-programme(?:(?!</section>).)*?</section>', html, re.S)
        if not m:
            raise SystemExit("could not find the programme section to insert after")
        html = html[: m.end()] + "\n" + section + html[m.end():]
        print("inserted after the programme section")
    HOME.write_text(html, encoding="utf-8")
    print("clipboard-free check — iframes on home page:", html.count("widget.getyourguide.com/default/availability.frame"))


if __name__ == "__main__":
    main()
