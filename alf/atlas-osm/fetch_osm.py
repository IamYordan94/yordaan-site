#!/usr/bin/env python3
"""Fetch real Amsterdam canal + building geometry from Overpass (OSM) for the 3D atlas.

Saves raw Overpass JSON plus a simplified GeoJSON the web app can consume.
No API key. Run:  python3 fetch_osm.py
"""
import json, os, sys, time, urllib.request, urllib.parse

BBOX = (52.355, 4.870, 52.385, 4.925)  # south, west, north, east
OUT = os.path.dirname(os.path.abspath(__file__))
MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.osm.ch/api/interpreter",
]

QUERY = """
[out:json][timeout:180];
(
  way["building"]({s},{w},{n},{e});
  way["waterway"]({s},{w},{n},{e});
  way["natural"="water"]({s},{w},{n},{e});
  way["water"]({s},{w},{n},{e});
  way["bridge"]({s},{w},{n},{e});
);
out geom;
""".format(s=BBOX[0], w=BBOX[1], n=BBOX[2], e=BBOX[3])


def fetch(url: str, body: bytes, timeout: int = 240) -> dict:
    req = urllib.request.Request(
        url, data=body,
        headers={"User-Agent": "alf-atlas-builder/1.0 (personal project)",
                 "Content-Type": "application/x-www-form-urlencoded"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def main() -> int:
    body = urllib.parse.urlencode({"data": QUERY}).encode()
    last_err = None
    data = None
    for m in MIRRORS:
        try:
            t0 = time.time()
            print(f"trying {m} ...", flush=True)
            data = fetch(m, body)
            print(f"  ok in {time.time()-t0:.1f}s", flush=True)
            break
        except Exception as e:  # noqa: BLE001 - report and try the next mirror
            last_err = f"{m}: {type(e).__name__}: {e}"
            print(f"  failed: {last_err}", flush=True)
    if data is None:
        print("ALL MIRRORS FAILED:", last_err, file=sys.stderr)
        return 2

    raw_path = os.path.join(OUT, "osm_raw.json")
    with open(raw_path, "w", encoding="utf-8") as f:
        json.dump(data, f)
    print(f"raw saved: {raw_path} ({os.path.getsize(raw_path)} bytes)")

    els = data.get("elements", [])
    buildings, water, bridges = [], [], []
    for el in els:
        geom = el.get("geometry")
        if not geom:
            continue
        coords = [[round(p["lon"], 6), round(p["lat"], 6)] for p in geom]
        tags = el.get("tags", {})
        rec = {"id": el["id"], "coords": coords, "tags": tags}
        if tags.get("bridge") and any(v in ("yes", "viaduct", "aqueduct") for v in [tags["bridge"]]):
            bridges.append(rec)
        if "building" in tags:
            h = tags.get("height") or tags.get("building:height")
            lv = tags.get("building:levels")
            try:
                height = float(str(h).replace("m", "").strip()) if h else (
                    float(lv) * 3.0 if lv else 12.0)
            except ValueError:
                height = 12.0
            buildings.append({"id": el["id"], "coords": coords, "height": round(height, 1)})
        if tags.get("waterway") or tags.get("natural") == "water" or tags.get("water"):
            kind = tags.get("waterway") or tags.get("water") or "water"
            water.append({"id": el["id"], "coords": coords, "kind": kind,
                          "name": tags.get("name", "")})

    out = {"source": "OpenStreetMap via Overpass API",
           "license": "ODbL 1.0 - (c) OpenStreetMap contributors",
           "bbox": BBOX,
           "buildings": buildings, "water": water, "bridges": bridges}
    geo_path = os.path.join(OUT, "city.json")
    with open(geo_path, "w", encoding="utf-8") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"city.json: {os.path.getsize(geo_path)} bytes")
    print(f"buildings={len(buildings)} water={len(water)} bridges={len(bridges)} "
          f"total_vertices={sum(len(b['coords']) for b in buildings)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
