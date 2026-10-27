/*! Evergreen garlands that hang themselves. Yordan Creatives, no dependencies.
 *  attachGarland(el, {mode:"bottom"|"loop", density, inner, seed}) -> canvas|null.
 *  "bottom" hangs from the element's bottom edge and reserves that space;
 *  "loop" is drawn outside the box, and on body it traces the viewport.
 *  Declarative: <div data-garland="bottom|loop" data-garland-inner="0">.
 *  One shared rAF loop, paused per garland by IntersectionObserver; the needle
 *  mass bakes once per resize (dpr <= 2) into an offscreen canvas and is blitted,
 *  so a live frame is one drawImage plus a few LED glows; a throttled-rAF watchdog
 *  paints the finished run; prefers-reduced-motion gets that frame once, no loop.
 *  Readable source: js/garland.src.js.
 */
(function () {
  "use strict";

  var MQ = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;

  /* Three value bands, drawn back to front: DEEP is the interior the eye reads as
     shadow between branches, MID the body, TIP the growth that catches the light.
     Each band carries a cool and a warm variant so the mass is never one green. */
  var DEEP = ["#06190c", "#081f10", "#0a2413", "#06231f"],
      MID  = ["#0f4a2c", "#14532f", "#185d36", "#1b6339", "#154a33", "#175536"],
      TIP  = ["#2f7343", "#3d8a4c", "#54a15d", "#6fb675", "#95c99a", "#aad3a4", "#8fc39b", "#9cbf6f"],
      FINE = ["#2a6a3c", "#3a8449", "#4d9756"],
      STEM = ["#15352a", "#1c4132"],
      WARM = "232,132,18",
      WID  = [0.82, 1.15, 1.6],
      HL   = ["#7fba87", "#9dcda1", "#bcdcb4"],
      list = [], q = [], raf = 0, sprite = null, pocket = null;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function now() { return (window.performance || Date).now(); }
  function dist(a, b) { var x = b.x - a.x, y = b.y - a.y; return Math.sqrt(x * x + y * y); }

  /* xorshift32 — the same seed draws the same garland on every load. */
  function prng(seed) {
    var s = (seed | 0) || 1;
    return function () {
      s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s |= 0;
      return (s >>> 0) / 4294967296;
    };
  }

  /* Perpendicular at every point, oriented away from a centre: the outward face. */
  function normals(p, cx, cy) {
    for (var i = 0; i < p.length; i++) {
      var a = p[Math.max(0, i - 1)], b = p[Math.min(p.length - 1, i + 1)],
          dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || 1,
          nx = -dy / d, ny = dx / d;
      if ((p[i].x - cx) * nx + (p[i].y - cy) * ny < 0) { nx = -nx; ny = -ny; }
      p[i].nx = nx; p[i].ny = ny;
    }
    return p;
  }

  /* A hanging cord: higher at both ends, sagging in the middle, with a wobble. */
  function bottomPath(w, h) {
    var pts = [], m = clamp(w * 0.016, 8, 20), span = w - 2 * m,
        n = Math.max(30, Math.round(span / 4)), i, u;
    for (i = 0; i <= n; i++) {
      u = i / n;
      pts.push({
        x: m + span * u,
        y: h * 0.2
          + Math.sin(u * 7.9 + 0.9) * h * 0.062          /* swags along the run */
          + Math.sin(u * 3.1 + 2.3) * h * 0.03
          + Math.sin(u * 15.7 + 1.1) * h * 0.012
          - Math.sin(Math.PI * u) * h * 0.045
      });
    }
    return normals(pts, w / 2, -h * 3);
  }

  /* A cord that follows the box: rounded rectangle, sagging between fastenings. */
  function loopPath(w, h) {
    var r = clamp(Math.min(w, h) * 0.06, 9, 26), pts = [],
        x0 = r + 4, y0 = r + 4, x1 = w - r - 4, y1 = h - r - 4, i, t, s, a;

    function seg(ax, ay, bx, by, nx, ny, sag) {
      var d = Math.sqrt((bx - ax) * (bx - ax) + (by - ay) * (by - ay)), n = Math.max(3, Math.round(d / 5));
      for (var k = 0; k < n; k++) {
        t = k / n; s = Math.sin(Math.PI * t) * sag;
        pts.push({ x: ax + (bx - ax) * t + nx * s, y: ay + (by - ay) * t + ny * s });
      }
    }
    function arc(cx, cy, a0) {
      for (i = 0; i <= 5; i++) { a = a0 + (Math.PI / 2) * i / 5; pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }); }
    }
    seg(x0, y0, x1, y0, 0, 1, 3.5); arc(x1, y0, -Math.PI / 2);
    seg(x1, y0, x1, y1, -1, 0, 2.4); arc(x1, y1, 0);
    seg(x1, y1, x0, y1, 0, -1, 3.5); arc(x0, y1, Math.PI / 2);
    seg(x0, y1, x0, y0, 1, 0, 2.4); arc(x0, y0, Math.PI);
    return normals(pts, w / 2, h / 2);
  }

  /* Arc-length lookup along the path, with interpolated outward normal. */
  function walk(pts) {
    var acc = [0], i, total = 0;
    for (i = 1; i < pts.length; i++) { total += dist(pts[i - 1], pts[i]); acc[i] = total; }
    return {
      total: total,
      at: function (s) {
        var i = 1;
        while (i < acc.length - 1 && acc[i] < s) i++;
        var t = (s - acc[i - 1]) / ((acc[i] - acc[i - 1]) || 1), a = pts[i - 1], b = pts[i];
        return {
          x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t,
          nx: a.nx + (b.nx - a.nx) * t, ny: a.ny + (b.ny - a.ny) * t
        };
      }
    };
  }

  /* One needle: a hairline blade. Value comes from how far out on the branch it
     grows and how much it faces the sky — the light sits on the top of the mass. */
  function needle(g, rnd, x, y, ang, len, lum) {
    var up = -Math.sin(ang),
        v = 0.52 + lum * 0.17 + up * 0.17 + (len / g.unit - 0.4) * 0.26 + (rnd() - 0.5) * 0.95,
        bi = v > 0.7 ? 2 : v > 0.31 ? 1 : 0,
        n = 2 + (rnd() < 0.45 ? 1 : 0);
    while (n--) {
      var a = ang + (n ? (rnd() - 0.5) * 0.22 : 0), l = len * (n ? 0.82 : 1),
          bow = (rnd() - 0.5) * l * 0.34;
      g.bands[bi].push({
        x0: x, y0: y,
        x1: x + Math.cos(a) * l, y1: y + Math.sin(a) * l,
        cx: x + Math.cos(a) * l * 0.5 - Math.sin(a) * bow,
        cy: y + Math.sin(a) * l * 0.5 + Math.cos(a) * bow,
        c: (rnd() * (bi === 2 ? TIP : bi === 1 ? MID : DEEP).length) | 0,
        w: len < 6.5 ? 0 : rnd() < 0.62 ? 1 : 2
      });
      /* the needle's own shading: a dark throat where it leaves the bud, and a
         light run along its upper side to the tip. Without these two the mass
         reads as flat cards rather than as foliage with recesses. */
      if (rnd() < 0.5 && bi > 0) {
        var sg2 = Math.cos(a) > 0 ? -1 : 1, ox = -Math.sin(a) * 0.34 * sg2, oy = Math.cos(a) * 0.34 * sg2;
        g.bands[3].push({
          x0: x + ox + Math.cos(a) * l * 0.35, y0: y + oy + Math.sin(a) * l * 0.35,
          x1: x + ox + Math.cos(a) * l * 0.98, y1: y + oy + Math.sin(a) * l * 0.98,
          c: (rnd() * HL.length) | 0
        });
      }
      if (rnd() < 0.55) {
        g.bands[4].push({
          x0: x, y0: y, x1: x + Math.cos(a) * l * 0.3, y1: y + Math.sin(a) * l * 0.3
        });
      }
    }
  }

  /* A fascicle: three to eight needles from one bud, sharing a lean. */
  function fascicle(g, rnd, x, y, ang, len, lum, spread) {
    var n = 3 + (rnd() * 6 | 0), i;
    for (i = 0; i < n; i++) {
      needle(g, rnd, x, y, ang + (rnd() - 0.5) * (spread || 1.3), len * (0.55 + 0.6 * rnd()), lum);
    }
  }

  /* A hanging branch: a woody stem off the cord with fascicles all the way down,
     so depth is continuous instead of a chain of floating tufts. */
  function branch(g, rnd, sp, depth, unit) {
    var n = Math.max(3, Math.round(depth / (unit * 0.3))), i, t, dir = sp.ny > 0 ? 1 : -1;
    g.stems.push({
      x0: sp.x, y0: sp.y, x1: sp.x + (rnd() - 0.5) * unit * 1.6, y1: sp.y + dir * depth,
      cx: sp.x + (rnd() - 0.5) * unit * 1.8, cy: sp.y + dir * depth * 0.5,
      c: (rnd() * STEM.length) | 0
    });
    for (i = 0; i < n; i++) {
      t = (i + 0.5) / n;
      fascicle(g, rnd, sp.x + (rnd() - 0.5) * unit * 0.9 * t, sp.y + dir * depth * t,
        dir > 0 ? 1.57 + (rnd() - 0.5) * 2.2 : -1.57 + (rnd() - 0.5) * 2.2,
        unit * (0.45 + 0.3 * rnd()) * (1 - 0.3 * t), -0.15 + 0.45 * t, 1.6);
    }
  }

  /* Lay out the cord, the needle mass around it, branches, twigs and LEDs.
     Deterministic per seed. */
  function generate(g) {
    var rnd = prng(g.seed), loop = g.opts.mode === "loop", unit = g.unit,
        dens = g.opts.density, w = walk(g.path), total = w.total,
        thick = loop ? clamp(Math.min(g.W, g.H) * 0.055, 26, 48) : g.H * 0.44,
        area = loop ? total * thick * 2.2 : g.W * thick * 2.2,
        want = clamp(area / 3.4, 3600, 14000),
        s, sp, i, d, ang, len, lum, taper, n, a2, tl, ex, ey, off, br, t, ph = rnd() * 6.28, th;

    g.bands = [[], [], [], [], []];
    g.stems = [];
    g.clumps = [];
    g.leds = [];

    /* the mass: fascicles scattered through the body of the cord, densest at the
       edge where the silhouette is made of needle tips */
    var step = clamp(total / (want / 16), 3.2, 14) / dens;
    for (s = 0; s <= total; s += step * (0.55 + 0.9 * rnd()) * (0.82 + 0.28 * Math.sin(s / (unit * 2.1) + ph * 3))) {
      sp = w.at(Math.min(s, total));
      taper = loop ? 1 : clamp(Math.pow(Math.min(s, total - s) / (total * 0.09), 0.55), 0.02, 1);
      /* the rope is lumpy: big swells and thin places, never a uniform sausage */
      th = thick * (0.6 + 0.42 * Math.sin(s / (unit * 1.7) + ph) + 0.18 * Math.sin(s / (unit * 0.6) + ph * 2))
        * (loop ? 1 : 0.45 + 0.55 * taper);
      var nx0 = Math.atan2(sp.ny, sp.nx);

      /* a clump: one bunch of needles with its own axis, size and base shadow.
         Clumps of very different size, overlapping heavily, are what read as
         foliage; evenly scattered single needles read as a pile of sticks. */
      var k = (rnd() * 1.15 - 0.3) * th,
          cx2 = sp.x + sp.nx * k, cy2 = sp.y + sp.ny * k,
          size = unit * (0.42 + 0.55 * rnd()) * (0.4 + 0.6 * taper),
          axis = nx0 + (rnd() - 0.5) * 2.8,
          cnt = 8 + (rnd() * 11 | 0);
      for (i = 0; i < cnt; i++) {
        ang = axis + (rnd() - 0.5) * (0.7 + 1.1 * rnd());
        len = size * (0.5 + 0.65 * rnd());
        lum = 0.3 - k / Math.max(6, th) * 0.65 - 0.12 * rnd();
        needle(g, rnd, cx2 + (rnd() - 0.5) * size * 0.35, cy2 + (rnd() - 0.5) * size * 0.35,
          ang, len, lum);
      }
      g.clumps.push({ x: cx2, y: cy2, r: size * (0.4 + 0.2 * rnd()) });

      /* a few needles hanging off the lower silhhouette, longer than the rest */
      if (rnd() < 0.6) {
        var fe = { x: sp.x + sp.nx * th * (0.5 + 0.35 * rnd()), y: sp.y + sp.ny * th * (0.5 + 0.35 * rnd()) };
        for (i = 0; i < 3; i++) {
          needle(g, rnd, fe.x, fe.y, nx0 + Math.PI * 0.5 + (rnd() - 0.5) * 1.6,
            unit * (0.8 + 0.6 * rnd()) * (0.5 + 0.5 * taper), 0.25);
        }
      }
    }

    /* hanging branches off the cord, at uneven intervals */
    if (!loop) {
      for (s = total * 0.05; s < total * 0.96; s += unit * (1.7 + 3.4 * rnd())) {
        sp = w.at(s);
        taper = clamp(Math.min(s, total - s) / (total * 0.08), 0, 1);
        branch(g, rnd, sp, g.H * (0.14 + 0.26 * rnd()) * (0.4 + 0.6 * taper), unit);
      }
    }

    /* woody twigs, and the odd long sprig that breaks the silhouette */
    n = loop ? 16 : 12 + (rnd() * 10 | 0);
    for (i = 0; i < n; i++) {
      sp = w.at(total * (0.04 + 0.92 * rnd()));
      a2 = Math.atan2(sp.ny, sp.nx) + (rnd() - 0.5) * 2.6;
      tl = unit * (0.8 + 1.2 * rnd());
      ex = sp.x + Math.cos(a2) * tl;
      ey = sp.y + Math.sin(a2) * tl;
      g.stems.push({
        x0: sp.x, y0: sp.y, x1: ex, y1: ey,
        cx: (sp.x + ex) / 2 + (rnd() - 0.5) * tl * 0.4, cy: (sp.y + ey) / 2 + (rnd() - 0.5) * tl * 0.4,
        c: (rnd() * STEM.length) | 0
      });
      for (var j = 1; j <= 3; j++) {
        t = j / 4;
        fascicle(g, rnd, sp.x + (ex - sp.x) * t, sp.y + (ey - sp.y) * t,
          a2 + (rnd() < 0.5 ? -1 : 1) * (0.6 + 0.6 * rnd()),
          unit * (0.5 + 0.35 * rnd()), 0.15 + 0.3 * t, 2.2);
      }
    }

    /* LEDs: pairs and long gaps, never an even run */
    for (s = total * (0.04 + 0.06 * rnd()); s < total * 0.95; s += unit * (2.6 + 6.4 * rnd())) {
      sp = w.at(s);
      off = unit * (0.3 + 0.3 * rnd());
      br = clamp(unit * 0.26, 2.8, 4.8);
      g.leds.push({
        x: sp.x + sp.nx * off, y: sp.y + sp.ny * off, sx: sp.x, sy: sp.y,
        r: br, ph: rnd() * 6.283, sp: 0.38 + 0.55 * rnd()
      });
      if (rnd() < 0.18) {
        g.leds.push({
          x: sp.x + sp.nx * off * 0.5 + unit * 1.6, y: sp.y + sp.ny * off * 0.5 + unit * 0.5,
          sx: sp.x + unit, sy: sp.y, r: br * 0.85, ph: rnd() * 6.283, sp: 0.38 + 0.55 * rnd()
        });
      }
    }
  }

  /* Stroke a band: one path per colour and width, flushed every few hundred
     needles. Skia slows down sharply on one path with thousands of segments. */
  function band(ctx, arr, pal, alpha) {
    var MAX = 600, i, n, open = 0, c, wd, k = ctx.wf || 1;
    for (c = 0; c < pal.length; c++) {
      for (wd = 0; wd < WID.length; wd++) {
        ctx.strokeStyle = pal[c];
        ctx.lineWidth = WID[wd] * k;
        ctx.globalAlpha = alpha * (0.85 + 0.15 * (wd === 2));
        ctx.beginPath();
        for (i = 0; i < arr.length; i++) {
          n = arr[i];
          if (n.c !== c || n.w !== wd) continue;
          ctx.moveTo(n.x0, n.y0);
          ctx.quadraticCurveTo(n.cx, n.cy, n.x1, n.y1);
          if (++open >= MAX) { ctx.stroke(); ctx.beginPath(); open = 0; }
        }
        if (open) { ctx.stroke(); open = 0; }
      }
    }
    ctx.globalAlpha = 1;
  }

  /* A hairline pass: one thin stroke per entry, batched. Used for the lit edge
     of a needle and for the dark throat where it leaves the bud. */
  function strokes(ctx, arr, pal, width, alpha) {
    var MAX = 700, i, n, open = 0, c;
    ctx.lineWidth = width * (ctx.wf || 1);
    for (c = 0; c < pal.length; c++) {
      ctx.strokeStyle = pal[c];
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      for (i = 0; i < arr.length; i++) {
        n = arr[i];
        if (pal.length > 1 && n.c !== c) continue;
        ctx.moveTo(n.x0, n.y0);
        ctx.lineTo(n.x1, n.y1);
        if (++open >= MAX) { ctx.stroke(); ctx.beginPath(); open = 0; }
      }
      if (open) { ctx.stroke(); open = 0; }
    }
    ctx.globalAlpha = 1;
  }

  function glow() {
    if (sprite) return sprite;
    var c = document.createElement("canvas"), x = c.getContext("2d"), gr;
    c.width = c.height = 64;
    gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(255,251,238,0.98)");
    gr.addColorStop(0.1, "rgba(255,224,168,0.78)");
    gr.addColorStop(0.28, "rgba(" + WARM + ",0.3)");
    gr.addColorStop(0.62, "rgba(" + WARM + ",0.07)");
    gr.addColorStop(1, "rgba(" + WARM + ",0)");
    x.fillStyle = gr;
    x.fillRect(0, 0, 64, 64);
    sprite = c;
    return c;
  }

  /* Soft sprite used for the dark interior between needles — never a hard edge. */
  function pocketSprite(rgb, core) {
    var key = rgb + core;
    pocket = pocket || {};
    if (pocket[key]) return pocket[key];
    var c = document.createElement("canvas"), x = c.getContext("2d"), gr;
    c.width = c.height = 64;
    gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(" + rgb + "," + core + ")");
    gr.addColorStop(0.4, "rgba(" + rgb + "," + core * 0.85 + ")");
    gr.addColorStop(1, "rgba(" + rgb + ",0)");
    x.fillStyle = gr;
    x.fillRect(0, 0, 64, 64);
    pocket[key] = c;
    return c;
  }

  /* Bake once per resize: interior shadow, needles, stems, grain, spill, sockets,
     cast shadow. */
  function bake(g) {
    var W = g.W, H = g.H, rnd = prng(g.seed + 977),
        mass = g.mass || (g.mass = document.createElement("canvas")),
        c = mass.getContext("2d"), i, p = g.path, bands, leds = g.leds,
        b, L, rad, sg, lc, sh, sc, n, sp, m;

    mass.width = Math.max(1, Math.round(W * g.dpr));
    mass.height = Math.max(1, Math.round(H * g.dpr));
    c.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    c.lineCap = "round";
    c.lineJoin = "round";
    c.wf = g.dpr < 2 ? 1.45 : 1;          /* keep every stroke a device pixel wide */

    bands = g.bands;
    band(c, bands[0], DEEP, 1);
    band(c, bands[1], MID, 1);
    band(c, bands[2], TIP, 0.96);
    strokes(c, bands[3], HL, 0.5, 0.34);
    strokes(c, bands[4], ["#04140a"], 1.15, 0.42);

    /* everything that shades the needles is composited source-atop, so the
       interior shadow can never leak onto the page as a smudge */
    c.globalCompositeOperation = "source-atop";

    /* contact shadow at the base of every clump: the recess the eye reads as the
       gap between two branches */
    for (i = 0; i < g.clumps.length; i++) {
      b = g.clumps[i];
      c.globalAlpha = 0.3;
      c.drawImage(pocketSprite("3,15,9", 0.85), b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
    }
    c.globalAlpha = 1;

    /* the interior: dark pockets through the middle of the cord, mottled so the
       mass has depth instead of an even tone */
    m = clamp(Math.round(g.W / 5), 60, 460);
    for (i = 0; i < m; i++) {
      n = p[Math.min(p.length - 1, (rnd() * p.length) | 0)];
      var d = (rnd() * 1.1 - 0.36) * g.H * 0.26;
      rad = 5 + rnd() * 15;
      c.globalAlpha = 0.35 + 0.35 * rnd();
      c.drawImage(pocketSprite(rnd() < 0.72 ? "3,16,9" : "30,76,44", rnd() < 0.72 ? 0.8 : 0.45),
        n.x + n.nx * d - rad, n.y + n.ny * d - rad, rad * 2, rad * 2);
    }
    c.globalAlpha = 1;

    /* woody twigs, woven through the needles */
    c.lineWidth = clamp(g.unit * 0.07, 0.9, 1.7);
    for (var s2 = 0; s2 < STEM.length; s2++) {
      c.strokeStyle = STEM[s2];
      c.beginPath();
      for (i = 0; i < g.stems.length; i++) {
        b = g.stems[i];
        if (b.c !== s2) continue;
        c.moveTo(b.x0, b.y0);
        c.quadraticCurveTo(b.cx, b.cy, b.x1, b.y1);
      }
      c.stroke();
    }
    c.globalCompositeOperation = "source-over";

    /* needles right around a bulb catch its light — a few bright strokes, which
       is what makes the glow read as illumination rather than as a halo */
    c.strokeStyle = "#c9c479";
    c.lineWidth = 1.25 * (c.wf || 1);
    for (i = 0; i < leds.length; i++) {
      L = leds[i];
      c.globalAlpha = 0.7;
      c.beginPath();
      for (var k = 0; k < 11; k++) {
        var aa = rnd() * 6.283, r0 = L.r * (0.9 + rnd() * 1.3);
        c.moveTo(L.x + Math.cos(aa) * r0, L.y + Math.sin(aa) * r0);
        c.lineTo(L.x + Math.cos(aa) * (r0 + 3 + rnd() * 4), L.y + Math.sin(aa) * (r0 + 3 + rnd() * 4));
      }
      c.stroke();
    }
    c.globalAlpha = 1;

    /* the light string: a thin cable sagging from bulb to bulb, so the lights read
       as strung into the garland rather than pasted onto it */
    if (leds.length > 1) {
      c.strokeStyle = "rgba(26,24,18,0.4)";
      c.lineWidth = 0.8;
      c.beginPath();
      for (i = 1; i < leds.length; i++) {
        L = leds[i];
        c.moveTo(leds[i - 1].x, leds[i - 1].y);
        c.quadraticCurveTo((leds[i - 1].x + L.x) / 2, (leds[i - 1].y + L.y) / 2 + L.r * 1.1, L.x, L.y);
      }
      c.stroke();
    }

    /* one light direction for the whole object: the top of the mass catches the
       sky, the underside falls away. This is the shading that gives the rope a
       round section instead of a flat one. */
    c.globalCompositeOperation = "source-atop";
    var tone = c.createLinearGradient(0, H * 0.08, 0, H * 0.92);
    tone.addColorStop(0, "rgba(206,232,178,0.07)");
    tone.addColorStop(0.28, "rgba(255,255,255,0)");
    tone.addColorStop(0.62, "rgba(4,16,10,0.2)");
    tone.addColorStop(1, "rgba(2,9,5,0.5)");
    c.fillStyle = tone;
    c.fillRect(0, 0, W, H);
    c.globalCompositeOperation = "source-over";

    /* warm spill: each bulb lights the needles around it and never the page —
       source-atop keeps it inside the painted garland */
    c.globalCompositeOperation = "source-atop";
    for (i = 0; i < leds.length; i++) {
      L = leds[i];
      rad = L.r * 8;
      sg = c.createRadialGradient(L.x, L.y, 0, L.x, L.y, rad);
      sg.addColorStop(0, "rgba(255,224,172,0.9)");
      sg.addColorStop(0.22, "rgba(252,194,118,0.58)");
      sg.addColorStop(0.55, "rgba(240,172,86,0.24)");
      sg.addColorStop(1, "rgba(" + WARM + ",0)");
      c.fillStyle = sg;
      c.beginPath();
      c.arc(L.x, L.y, rad, 0, 6.2832);
      c.fill();
    }
    c.globalCompositeOperation = "source-over";

    /* the bulb: a dark cap and socket over warm glass, so it reads as fitted in */
    for (i = 0; i < leds.length; i++) {
      L = leds[i];
      c.strokeStyle = "rgba(12,16,10,0.8)";
      c.lineWidth = 1.1;
      c.beginPath();
      c.moveTo(L.sx, L.sy);
      c.lineTo(L.x, L.y - L.r * 0.85);
      c.stroke();
      c.fillStyle = "rgba(255,226,178,0.7)";
      c.beginPath();
      c.ellipse(L.x, L.y + L.r * 0.14, L.r * 0.6, L.r * 0.66, 0, 0, 6.2832);
      c.fill();
      c.fillStyle = "rgba(24,28,18,0.96)";
      c.beginPath();
      c.ellipse(L.x, L.y - L.r * 0.62, L.r * 0.56, L.r * 0.52, 0, 0, 6.2832);
      c.fill();
    }

    /* "loop" with inner:false is a wreath around the content: punch the content
       box out of the foliage and out of its glow. The cut is feathered, so the
       wreath fades into the box instead of ending on a straight line. */
    if (g.opts.mode === "loop" && !g.opts.inner && g.box) {
      g.hole = g.hole || document.createElement("canvas");
      g.hole.width = mass.width;
      g.hole.height = mass.height;
      var hc = g.hole.getContext("2d");
      hc.setTransform(1, 0, 0, 1, 0, 0);
      hc.clearRect(0, 0, mass.width, mass.height);
      /* the feather has to finish OUTSIDE the box, so the punch is grown by half
         the blur: the content itself gets a clean cut, the foliage fades into it */
      var pa = 9;
      hc.filter = "blur(" + Math.round(4 * g.dpr) + "px)";
      hc.fillStyle = "#fff";
      hc.fillRect((g.box.x - pa) * g.dpr, (g.box.y - pa) * g.dpr,
        (g.box.w + pa * 2) * g.dpr, (g.box.h + pa * 2) * g.dpr);
      hc.filter = "none";
      c.globalCompositeOperation = "destination-out";
      c.drawImage(g.hole, 0, 0, W, H);
      c.globalCompositeOperation = "source-over";
    }

    /* shadow from the garland's own silhouette, blurred, so it sits on the page */
    g.layer.width = mass.width;
    g.layer.height = mass.height;
    lc = g.layer.getContext("2d");
    lc.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);
    lc.clearRect(0, 0, W, H);
    sh = g.shadow || (g.shadow = document.createElement("canvas"));
    sh.width = mass.width;
    sh.height = mass.height;
    sc = sh.getContext("2d");
    sc.clearRect(0, 0, sh.width, sh.height);
    sc.filter = "blur(" + Math.round(2.5 * g.dpr) + "px)";
    if (sc.filter && sc.filter.indexOf("blur") === 0) {
      sc.drawImage(mass, 1 * g.dpr, 5 * g.dpr);
      sc.filter = "none";
      sc.globalCompositeOperation = "source-in";
      sc.fillStyle = "rgba(14,44,28,0.42)";
      sc.fillRect(0, 0, sh.width, sh.height);
      sc.globalCompositeOperation = "source-over";
      lc.drawImage(sh, 0, 0, W, H);
    }
    lc.drawImage(mass, 0, 0, W, H);

  }

  function draw(g, t) {
    var c = g.ctx, i, L, x, y, tw, rad;
    if (!c || !g.W || !g.layer.width) return;
    c.clearRect(0, 0, g.W, g.H);

    var mask = g.hole;

    /* halos first, under the foliage: the needles then occlude each glow, which
       is what makes a bulb read as sitting inside the garland instead of on it */
    for (i = 0; i < g.leds.length; i++) {
      L = g.leds[i];
      tw = 0.62 + 0.38 * Math.sin(t * 0.001 * L.sp + L.ph);
      x = L.x; y = L.y + g.spring;
      rad = L.r * (5.2 + 1.1 * tw);
      c.globalAlpha = 0.34 + 0.34 * tw;
      c.drawImage(glow(), x - rad, y - rad, rad * 2, rad * 2);
      c.globalAlpha = 1;
    }
    if (mask) {
      c.globalCompositeOperation = "destination-out";
      c.drawImage(mask, 0, 0, g.W, g.H);
      c.globalCompositeOperation = "source-over";
    }
    c.drawImage(g.layer, 0, g.spring, g.W, g.H);

    /* the bulb itself, in front: a small bright core in a dark collar */
    for (i = 0; i < g.leds.length; i++) {
      L = g.leds[i];
      tw = 0.62 + 0.38 * Math.sin(t * 0.001 * L.sp + L.ph);
      x = L.x; y = L.y + g.spring;
      c.globalAlpha = 0.62 + 0.36 * tw;
      c.fillStyle = "rgba(255,250,232,1)";
      c.beginPath();
      c.arc(x, y + L.r * 0.16, L.r * (0.5 + 0.1 * tw), 0, 6.2832);
      c.fill();
      c.globalAlpha = 1;
    }
  }

  /* Place, size and (re)bake. Returns false when the element has no box yet. */
  function layout(g) {
    var el = g.el, mode = g.opts.mode, vw = document.documentElement.clientWidth,
        r = el.getBoundingClientRect(), sx = window.pageXOffset || 0, sy = window.pageYOffset || 0,
        W, H, left, top, fixed = false, ins, need, cur;

    if (mode === "loop" && (el === document.body || el === document.documentElement)) {
      left = clamp(Math.round(vw * 0.014), 9, 26);
      top = left;
      W = vw - 2 * left;
      H = document.documentElement.clientHeight - 2 * left;
      fixed = true;
    } else {
      if (r.width < 30 || r.height < 4) { g.canvas.style.display = "none"; g.W = 0; return false; }
      left = Math.round(r.left + sx);
      top = Math.round(r.top + sy);
      if (mode === "loop") {
        ins = clamp(Math.round(Math.min(r.width, r.height) * 0.05), 10, 22) + 4;
        ins = clamp(Math.min(ins, left, vw - (left + r.width)), 5, 26);
        left -= ins; top -= ins;
        W = Math.round(r.width + 2 * ins);
        H = Math.round(r.height + 2 * ins);
      } else {
        top = Math.round(r.bottom + sy);
        H = vw < 640 ? 62 : clamp(Math.round(vw * 0.074), 88, 104);
        left -= 12;
        W = Math.round(r.width + 26);
      }
      left = clamp(left, 0, Math.max(0, vw - 24));
      W = Math.min(W, vw - left);
      if (W < 40) { g.canvas.style.display = "none"; g.W = 0; return false; }
    }

    g.W = W; g.H = H;
    g.dpr = Math.min(window.devicePixelRatio || 1, 2);
    g.canvas.style.display = "block";
    g.canvas.style.position = fixed ? "fixed" : "absolute";
    g.canvas.style.left = left + "px";
    g.canvas.style.top = top + "px";
    g.canvas.style.width = W + "px";
    g.canvas.style.height = H + "px";
    g.canvas.width = Math.round(W * g.dpr);
    g.canvas.height = Math.round(H * g.dpr);
    g.ctx.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);

    g.box = {x: Math.round(r.left + sx) - left, y: Math.round(r.top + sy) - top,
             w: Math.round(r.width), h: Math.round(r.height)};
    g.path = mode === "loop" ? loopPath(W, H) : bottomPath(W, H);
    g.unit = mode === "loop" ? clamp(Math.min(W, H) * 0.028, 8, 13) : clamp(H * 0.19, 8, 19);

    /* A bottom garland hangs below the element: reserve that space so the mass
       can never sit on the copy that follows. */
    if (mode === "bottom") {
      need = H + 4;
      cur = parseFloat(getComputedStyle(el).marginBottom) || 0;
      if (el.__gm === undefined) el.__gm = el.style.marginBottom;
      el.style.marginBottom = Math.max(cur, need) + "px";
    }

    generate(g);
    bake(g);
    if (!g.settled) g.spring = -Math.min(26, H * 0.3);
    return true;
  }

  function frame(t) {
    raf = 0;
    var live = 0, g, dt, p, i;
    for (i = 0; i < list.length; i++) {
      g = list[i];
      if (g.done || !g.visible) continue;
      if (!g.last) g.last = t;
      dt = Math.min(64, t - g.last);
      g.last = t;
      g.t += dt;
      if (g.spring < -0.15) {
        p = clamp(g.t / 900, 0, 1);
        g.spring = -Math.min(26, g.H * 0.3) * (1 - p) * Math.cos(p * 5.2) * 0.55;
      } else g.spring = 0;
      draw(g, g.t);
      live++;
    }
    if (live) raf = requestAnimationFrame(frame);
  }

  function kick() {
    if (!raf && !document.hidden) raf = requestAnimationFrame(frame);
  }

  function watch(g) {
    g.watchdog = setTimeout(function () {
      if (!g.alive || g.done || g.t >= 60) return;
      if (g.visible || document.hidden) { g.t = 1400; g.spring = 0; draw(g, 1400); g.done = true; }
    }, 900);
  }

  /* One finished frame now, so a slot is never blank; the loop animates from it. */
  function settle(g) {
    g.spring = 0;
    g.t = 700;
    draw(g, 700);
    if (MQ && MQ.matches) { g.done = true; return; }
    g.t = 0;
    g.spring = -Math.min(26, g.H * 0.3);
    g.last = 0;
    if (g.visible) kick();
  }

  /* The first garland bakes immediately; the rest bake on the next task, so a page
     with several garlands never blocks its first frame for all of them. */
  function pump() {
    if (!q.length) return;
    var g = q.shift();
    if (g.alive && layout(g)) settle(g);
    if (q.length) setTimeout(pump, 24);
  }

  function build(el, opts) {
    var g = {
      el: el, opts: opts, canvas: document.createElement("canvas"), ctx: null,
      layer: document.createElement("canvas"), mass: null, shadow: null,
      path: [], bands: [[], [], [], [], []], stems: [], clumps: [], leds: [],
      unit: 10, W: 0, H: 0, dpr: 1, t: 0, spring: 0, last: 0,
      settled: false, done: false, visible: false, alive: true, seed: opts.seed
    }, st = g.canvas.style, timer = 0, ok;

    g.canvas.setAttribute("aria-hidden", "true");
    g.canvas.setAttribute("data-garland", opts.mode);
    st.pointerEvents = "none";
    st.zIndex = "3";
    st.display = "none";
    g.ctx = g.canvas.getContext("2d");
    if (!g.ctx) return null;
    document.body.appendChild(g.canvas);
    g.canvas.__g = g;

    if (window.IntersectionObserver) {
      g.io = new IntersectionObserver(function (es) {
        for (var i = 0; i < es.length; i++) if (es[i].target === el) g.visible = es[i].isIntersecting;
        kick();
      }, { rootMargin: "160px 0px" });
      g.io.observe(el);
    } else g.visible = true;

    if (q.length || list.length) { q.push(g); setTimeout(pump, 0); }
    else { ok = layout(g); if (ok) settle(g); }

    if (window.ResizeObserver) {
      g.ro = new ResizeObserver(function () {
        clearTimeout(timer);
        timer = setTimeout(function () {
          if (!g.alive || !g.W) return;
          if (layout(g)) { g.settled = true; settle(g); }
        }, 160);
      });
      g.ro.observe(el);
    }

    if (!g.done) { list.push(g); kick(); watch(g); }
    return g.canvas;
  }

  function auto() {
    var els = document.querySelectorAll("[data-garland]"), i, el;
    for (i = 0; i < els.length; i++) {
      el = els[i];
      if (el.__garland) continue;
      window.attachGarland(el, {
        mode: el.getAttribute("data-garland"),
        density: el.getAttribute("data-garland-density"),
        inner: el.getAttribute("data-garland-inner") !== "0"
      });
    }
  }

  window.attachGarland = function (el, opts) {
    var target = typeof el === "string" ? document.querySelector(el) : el;
    opts = opts || {};
    if (!target || !target.getBoundingClientRect || target.__garland) return null;
    var g = build(target, {
      mode: opts.mode === "loop" ? "loop" : "bottom",
      density: clamp(parseFloat(opts.density) || 1, 0.6, 1.8),
      inner: !(opts.inner === false || opts.inner === "0"),
      seed: (parseFloat(opts.seed) || 7.31 * (list.length + q.length) + 3.7) + 1
    });
    target.__garland = g || true;
    return g || null;
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", auto);
  else auto();
  window.__garlandReady = true;
})();
