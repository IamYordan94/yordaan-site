/* A shopping-street facade at night.
   Procedural canvas: the roofline, a run of windows, and a festoon of bulbs
   that ignites left to right, lighting the architecture as it goes. Once the
   run is complete it settles into a slow shimmer. Vanilla canvas, no deps.

   Resized by devicePixelRatio (capped at 2). With prefers-reduced-motion the
   finished state is drawn once and never animated. */

(function () {
  'use strict';

  var canvas = document.getElementById('facade');
  if (!canvas || !canvas.getContext) { return; }

  var ctx = canvas.getContext('2d');
  if (!ctx) { return; }

  var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var reduce = !!(mq && mq.matches);

  var W = 0, H = 0, dpr = 1;

  var blocks = [];      // the facades
  var backdrop = [];    // rooftops behind them
  var windows = [];     // window rectangles, each with a reveal threshold
  var bulbs = [];

  var spanW = 0;        // distance between fixing points on the run
  var runY = 0;         // height of the cable
  var sagAmp = 0;       // how far each span droops
  var bulbR = 3;

  var progress = reduce ? 1 : 0;   // 0..1, how much of the run is lit
  var elapsed = 0;                 // install time consumed, in ms
  var installMs = 3000;
  var lastFrame = 0;
  var raf = 0;
  var running = false;
  var inView = true;

  var RAMP = 0.055;    // share of progress a single bulb takes to come up

  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : (v > hi ? hi : v);
  }

  /* ---------------------------------------------------------------- build */

  function build() {
    var rand = rng(42180735);
    var i, j, c;

    var roofMin = H * 0.12;
    var roofMax = H * 0.27;

    // Rooftops behind the street, above the main roofline: only silhouettes.
    backdrop = [];
    var bx = -W * 0.06;
    while (bx < W * 1.06) {
      var bw = W * (0.05 + rand() * 0.09);
      var bh = roofMin * (0.5 + rand() * 0.85);
      backdrop.push({ x: bx, w: bw, y: roofMin - bh, h: bh + H * 0.2 });
      bx += bw * (1 + rand() * 0.45);
    }

    blocks = [];
    windows = [];

    var nBlocks = W < 560 ? 3 : (W < 1000 ? 4 : 5);
    var weights = [];
    var total = 0;
    for (i = 0; i < nBlocks; i++) {
      var wt = 0.7 + rand() * 0.7;
      weights.push(wt);
      total += wt;
    }

    var tones = [
      ['#262632', '#15151b'],
      ['#1f1f2a', '#121217'],
      ['#2a2a36', '#16161d'],
      ['#22222d', '#131318']
    ];

    var x = -W * 0.06;
    var span = W * 1.12;

    for (i = 0; i < nBlocks; i++) {
      var bw2 = span * weights[i] / total;
      var x0 = x;
      var x1 = x + bw2;
      x = x1;

      var roof = roofMin + rand() * (roofMax - roofMin);
      var tone = tones[i % tones.length];
      blocks.push({
        x0: x0, x1: x1, roof: roof, top: tone[0], bottom: tone[1],
        fascia: H * 0.715, shopTop: H * 0.755
      });

      // Windows: a few large rectangles, not a grid of dots.
      var inset = bw2 * 0.10;
      var usable = bw2 - inset * 2;
      var cols = bw2 < W * 0.20 ? 2 : 3;
      var colPitch = usable / cols;
      var ww = Math.max(9, colPitch * 0.5);

      var rows = H < 250 ? 1 : 2;
      var topY = roof + H * 0.115;
      var bottomY = H * 0.665;
      var rowPitch = Math.max(20, (bottomY - topY) / rows);
      var wh = clamp(rowPitch * 0.46, 9, ww * 1.7);

      for (j = 0; j < rows; j++) {
        for (c = 0; c < cols; c++) {
          var cx = x0 + inset + colPitch * (c + 0.5);
          var cy = topY + rowPitch * (j + 0.5);
          windows.push({
            x: cx - ww / 2,
            y: cy - wh / 2,
            w: ww,
            h: wh,
            at: clamp((cx + W * 0.06) / span, 0.02, 0.98),
            tone: 0.55 + rand() * 0.45
          });
        }
      }
    }

    // One festoon, strung at a constant height across every facade.
    spanW = W / (W < 560 ? 2 : 3);
    runY = H * 0.45;
    sagAmp = H * 0.045;
    bulbR = clamp(2.2 + H * 0.005, 2.4, 4.4);

    bulbs = [];
    var n = Math.round(clamp(W / 46, 9, 30));
    for (i = 0; i < n; i++) {
      var t = i / (n - 1);
      bulbs.push({
        x: -18 + (W + 36) * t,
        at: t,
        phase: rand() * Math.PI * 2,
        size: bulbR * (0.86 + rand() * 0.28)
      });
    }
  }

  function cableY(px) {
    var frac = ((px + 18) / spanW) % 1;
    if (frac < 0) { frac += 1; }
    return runY + Math.sin(Math.PI * frac) * sagAmp;
  }

  /* ----------------------------------------------------------------- draw */

  function drawSky() {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#08080a');
    g.addColorStop(0.45, '#0c0e16');
    g.addColorStop(1, '#0e1018');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // City glow, sitting low behind the rooftops.
    var glow = ctx.createRadialGradient(
      W * 0.58, H * 0.30, 0,
      W * 0.58, H * 0.30, W * 0.62
    );
    glow.addColorStop(0, 'rgba(62,74,132,0.30)');
    glow.addColorStop(0.5, 'rgba(38,46,88,0.14)');
    glow.addColorStop(1, 'rgba(10,10,14,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
  }

  function drawBackdrop() {
    var i;
    ctx.fillStyle = '#17171f';
    for (i = 0; i < backdrop.length; i++) {
      var b = backdrop[i];
      ctx.fillRect(b.x, b.y, b.w, b.h);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    for (i = 0; i < backdrop.length; i++) {
      var d = backdrop[i];
      ctx.fillRect(d.x, d.y, d.w, 1);
    }
    // a few far windows, unlit but catching the sky
    ctx.fillStyle = 'rgba(140,160,220,0.055)';
    for (i = 0; i < backdrop.length; i++) {
      var e = backdrop[i];
      for (var k = 0; k < 3; k++) {
        ctx.fillRect(e.x + e.w * (0.2 + k * 0.25), e.y + 10 + (k * 7) % 14,
          Math.max(2, e.w * 0.09), Math.max(2, e.w * 0.09));
      }
    }
  }

  function drawBlocks() {
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      var w = b.x1 - b.x0;

      var g = ctx.createLinearGradient(0, b.roof, 0, H);
      g.addColorStop(0, b.top);
      g.addColorStop(0.55, b.top);
      g.addColorStop(1, b.bottom);
      ctx.fillStyle = g;
      ctx.fillRect(b.x0, b.roof, w, H - b.roof);

      // cornice: a light band, a shadow under it, warm light catching the lip
      ctx.fillStyle = 'rgba(255,236,206,0.16)';
      ctx.fillRect(b.x0, b.roof, w, 2);
      ctx.fillStyle = 'rgba(0,0,0,0.62)';
      ctx.fillRect(b.x0, b.roof + 2, w, 4);

      // party walls between buildings
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(b.x0, b.roof, 1.5, H - b.roof);
      ctx.fillRect(b.x1 - 1.5, b.roof, 1.5, H - b.roof);
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(b.x0 + 1.5, b.roof, 1, H - b.roof);
      ctx.fillRect(b.x1 - 2.5, b.roof, 1, H - b.roof);
    }
  }

  /* the ground floor: closed shopfronts, which is what sets the scale */
  function drawShopfronts() {
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      var w = b.x1 - b.x0;

      // fascia band over the shopfronts
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(b.x0, b.fascia, w, 3);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(b.x0, b.fascia + 3, w, 2);

      var inset = w * 0.06;
      var gap = w * 0.03;
      var pw = (w - inset * 2 - gap) / 2;
      var sh = H - b.shopTop;

      for (var p = 0; p < 2; p++) {
        var sx = b.x0 + inset + p * (pw + gap);

        var g = ctx.createLinearGradient(0, b.shopTop, 0, b.shopTop + sh);
        g.addColorStop(0, '#161a26');
        g.addColorStop(0.45, '#0d0f16');
        g.addColorStop(1, '#090a0e');
        ctx.fillStyle = g;
        ctx.fillRect(sx, b.shopTop, pw, sh);

        // the street, reflected in the glass
        var r = ctx.createLinearGradient(sx, b.shopTop, sx + pw, b.shopTop + sh);
        r.addColorStop(0, 'rgba(150,175,235,0.055)');
        r.addColorStop(0.5, 'rgba(150,175,235,0.012)');
        r.addColorStop(1, 'rgba(150,175,235,0.04)');
        ctx.fillStyle = r;
        ctx.fillRect(sx, b.shopTop, pw, sh);

        ctx.strokeStyle = 'rgba(255,255,255,0.055)';
        ctx.lineWidth = 1;
        ctx.strokeRect(sx + 0.5, b.shopTop + 0.5, pw - 1, sh - 1);
      }
    }
  }

  function drawWindows() {
    for (var i = 0; i < windows.length; i++) {
      var win = windows[i];
      var lit = clamp((progress - win.at) / 0.12, 0, 1);

      ctx.fillStyle = 'rgba(6,6,10,0.95)';
      ctx.fillRect(win.x, win.y, win.w, win.h);

      // glass catching the sky, whether or not the room behind is lit
      var sky = ctx.createLinearGradient(win.x, win.y, win.x, win.y + win.h);
      sky.addColorStop(0, 'rgba(150,170,225,0.075)');
      sky.addColorStop(0.45, 'rgba(120,140,200,0.02)');
      sky.addColorStop(1, 'rgba(120,140,200,0.05)');
      ctx.fillStyle = sky;
      ctx.fillRect(win.x, win.y, win.w, win.h);

      if (lit > 0.01) {
        var a = (0.16 + 0.24 * lit) * win.tone;
        var g = ctx.createLinearGradient(win.x, win.y, win.x, win.y + win.h);
        g.addColorStop(0, 'rgba(255,230,186,' + (a * 1.15).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(255,200,128,' + (a * 0.4).toFixed(3) + ')');
        ctx.fillStyle = g;
        ctx.fillRect(win.x, win.y, win.w, win.h);

        // glazing bars
        ctx.fillStyle = 'rgba(8,8,12,0.5)';
        ctx.fillRect(win.x + win.w / 2 - 0.75, win.y, 1.5, win.h);
        ctx.fillRect(win.x, win.y + win.h * 0.46, win.w, 1.2);

        // light spilling onto the wall
        var cx = win.x + win.w / 2;
        var cy = win.y + win.h / 2;
        var rr = Math.max(win.w, win.h) * 2;
        var s = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
        s.addColorStop(0, 'rgba(255,214,150,' + (0.14 * lit).toFixed(3) + ')');
        s.addColorStop(1, 'rgba(255,214,150,0)');
        ctx.fillStyle = s;
        ctx.beginPath();
        ctx.arc(cx, cy, rr, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.strokeStyle = 'rgba(255,255,255,' + (0.075 + 0.10 * lit).toFixed(3) + ')';
      ctx.lineWidth = 1;
      ctx.strokeRect(win.x + 0.5, win.y + 0.5, win.w - 1, win.h - 1);

      // a lintel above each window, so the facade reads as masonry
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      ctx.fillRect(win.x - 1, win.y - 2, win.w + 2, 1);
    }
  }

  /* warm wash over whatever the run has already lit */
  function drawWash() {
    if (progress <= 0.01) { return; }
    var headX = -18 + (W + 36) * progress;
    var top = runY - H * 0.30;
    var height = H * 0.62;

    var g = ctx.createLinearGradient(0, top, 0, top + height);
    g.addColorStop(0, 'rgba(255,206,140,0)');
    g.addColorStop(0.45, 'rgba(255,206,140,0.05)');
    g.addColorStop(0.7, 'rgba(255,206,140,0.035)');
    g.addColorStop(1, 'rgba(255,206,140,0)');

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, top, Math.max(0, headX), height);
    ctx.clip();
    ctx.fillStyle = g;
    ctx.fillRect(0, top, Math.max(0, headX), height);
    ctx.restore();
  }

  function drawRun(now) {
    var i, px, py;

    // cable, drawn quickly first so the bulbs have something to hang from
    var cableA = clamp(progress / 0.14, 0, 1);
    if (cableA > 0.01) {
      ctx.strokeStyle = 'rgba(0,0,0,' + (0.62 * cableA).toFixed(3) + ')';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (px = -18; px <= W + 18; px += 5) {
        py = cableY(px);
        if (px <= -18 + 5) { ctx.moveTo(px, py); } else { ctx.lineTo(px, py); }
      }
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255,214,150,' + (0.16 * cableA).toFixed(3) + ')';
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      for (px = -18; px <= W + 18; px += 5) {
        py = cableY(px) - 0.9;
        if (px <= -18 + 5) { ctx.moveTo(px, py); } else { ctx.lineTo(px, py); }
      }
      ctx.stroke();

      // fixing points where each span is tied back
      ctx.fillStyle = 'rgba(8,8,11,' + (0.7 * cableA).toFixed(3) + ')';
      for (px = -18; px <= W + 30; px += spanW) {
        ctx.fillRect(px - 1.5, cableY(px) - 1, 3, 4);
      }
    }

    for (i = 0; i < bulbs.length; i++) {
      var b = bulbs[i];
      var lit = clamp((progress - b.at) / RAMP, 0, 1);
      if (lit <= 0.004) { continue; }

      var sag = Math.sin(Math.PI * (((b.x + 18) / spanW) % 1));
      var x = b.x;
      var y = runY + sag * sagAmp + b.size + 2.5;

      var shimmer = 0.86 + 0.14 * Math.sin(now / 1150 + b.phase);
      var a = lit * shimmer;
      var r = b.size * (0.45 + 0.55 * lit);
      var glowR = b.size * 8;

      var g = ctx.createRadialGradient(x, y, 0, x, y, glowR);
      g.addColorStop(0, 'rgba(255,238,208,' + (0.55 * a).toFixed(3) + ')');
      g.addColorStop(0.22, 'rgba(255,214,150,' + (0.26 * a).toFixed(3) + ')');
      g.addColorStop(0.55, 'rgba(255,190,110,' + (0.075 * a).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(255,190,110,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, glowR, 0, Math.PI * 2);
      ctx.fill();

      // the glass
      ctx.fillStyle = 'rgba(255,232,190,' + (0.92 * lit).toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();

      // filament
      ctx.fillStyle = 'rgba(255,255,250,' + (0.9 * a).toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(x, y, r * 0.42, 0, Math.PI * 2);
      ctx.fill();

      // the cap that sits against the cable
      ctx.fillStyle = 'rgba(12,12,16,' + (0.8 * lit).toFixed(3) + ')';
      ctx.fillRect(x - 1.2, y - b.size - 3.2, 2.4, 3.4);
    }

    // the head of the install: one bright point while the run is going up
    if (progress > 0.02 && progress < 0.99) {
      var hx = -18 + (W + 36) * progress;
      var hy = cableY(hx) + 6;
      var spark = ctx.createRadialGradient(hx, hy, 0, hx, hy, 30);
      spark.addColorStop(0, 'rgba(255,255,255,0.95)');
      spark.addColorStop(0.3, 'rgba(255,226,180,0.45)');
      spark.addColorStop(1, 'rgba(255,214,150,0)');
      ctx.fillStyle = spark;
      ctx.beginPath();
      ctx.arc(hx, hy, 30, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function draw(now) {
    if (!W || !H) { return; }
    ctx.clearRect(0, 0, W, H);
    drawSky();
    drawBackdrop();
    drawBlocks();
    drawWindows();
    drawWash();
    drawRun(now);
  }

  function renderStatic() {
    progress = 1;
    draw(0);
  }

  /* ----------------------------------------------------------------- loop */

  function frame(now) {
    if (!running) { return; }

    if (!lastFrame) { lastFrame = now; }
    var dt = Math.min(64, now - lastFrame);
    lastFrame = now;

    if (progress < 1) {
      elapsed += dt;
      var t = clamp(elapsed / installMs, 0, 1);
      progress = 1 - Math.pow(1 - t, 3);
      if (progress > 0.999) { progress = 1; }
    }

    draw(now);
    raf = window.requestAnimationFrame(frame);
  }

  function start() {
    if (running || reduce || !W || !H) { return; }
    running = true;
    lastFrame = 0;
    raf = window.requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    if (raf) { window.cancelAnimationFrame(raf); }
    raf = 0;
  }

  /* ----------------------------------------------------------------- size */

  function size() {
    var rect = canvas.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) { return false; }

    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.round(rect.width);
    H = Math.round(rect.height);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    build();
    return true;
  }

  /* ----------------------------------------------------------------- init */

  size();

  if (reduce) {
    renderStatic();
  } else {
    start();
    // A backgrounded tab throttles requestAnimationFrame to a standstill; if no
    // frame has run by then, paint the finished facade rather than leave a hole.
    window.setTimeout(function () {
      if (!lastFrame) { renderStatic(); }
    }, 900);
  }

  var resizeTimer;
  window.addEventListener('resize', function () {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(function () {
      if (!size()) { return; }
      if (reduce) { renderStatic(); } else { draw(elapsed); }
    }, 150);
  });

  if (mq) {
    var onMotion = function () {
      reduce = mq.matches;
      if (reduce) {
        stop();
        renderStatic();
      } else if (!running) {
        start();
      }
    };
    if (mq.addEventListener) { mq.addEventListener('change', onMotion); }
    else if (mq.addListener) { mq.addListener(onMotion); }
  }

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      inView = entries[0].isIntersecting;
      if (inView) { start(); } else { stop(); }
    }, { rootMargin: '100px 0px' });
    io.observe(canvas);
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { stop(); }
    else if (inView) { start(); }
  });

  window.__facadeReady = true;
  window.__facadeDrawAt = function (ms) { draw(ms || 0); };
})();
