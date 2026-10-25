/* The lights install themselves.
   Festoon swags strung between poles above the headline: the cable is pulled
   across, each bulb ignites as the cable reaches it, then the whole run breathes
   and leans towards the pointer. Vanilla canvas, no dependencies.

   Composition rule: the scene lives in the TOP band of the hero and never
   reaches the headline. Drawing across the type made it read as a stray
   hairline, which is exactly what it must not do. */

(function () {
  'use strict';

  var canvas = document.getElementById('lights');
  if (!canvas || !canvas.getContext) return;

  var ctx = canvas.getContext('2d');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var W = 0, H = 0, dpr = 1;
  var front = [];       // the run being installed
  var back = [];        // a fainter run further away, for depth
  var progress = reduce ? 1 : 0;
  var startedAt = 0;
  var raf = 0, watchdog = 0, last = 0;
  var pointer = { x: -9999, y: -9999 };

  var INSTALL_MS = 3000;
  var WARM = [247, 154, 43];     // amber: needs saturation to read on white
  var HOT = [255, 238, 200];     // the lit filament
  var ACCENT = [31, 58, 224];

  function bandHeight() {
    // The scene owns the top of the hero: 30% on phones, 38% on wider screens.
    return H * (W < 700 ? 0.30 : 0.38);
  }

  function size() {
    var rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(320, Math.round(rect.width));
    H = Math.max(240, Math.round(rect.height));
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    build();
  }

  // One swag: a catenary between two x positions, hanging `sag` below `top`.
  function swag(x0, x1, top, sag, n, into, opts) {
    for (var i = 0; i < n; i++) {
      var t = i / (n - 1);
      var x = x0 + (x1 - x0) * t;
      var y = top + Math.sin(Math.PI * t) * sag;
      into.push({
        x: x,
        y: y,
        t: t,
        run: opts.run,
        colour: (opts.accentEvery && opts.index % opts.accentEvery === opts.accentEvery - 1) ? ACCENT : WARM,
        phase: Math.random() * Math.PI * 2,
        ign: -1
      });
      opts.index++;
    }
  }

  function build() {
    var narrow = W < 700;
    var top = H * (narrow ? 0.10 : 0.11);
    var band = bandHeight();

    var poles = narrow ? 3 : 4;
    var sag = band * (narrow ? 0.62 : 0.58);
    var perSwag = narrow ? 7 : 11;

    front = [];
    var opts = { run: 0, index: 0, accentEvery: 7 };
    for (var s = 0; s < poles; s++) {
      var x0 = -W * 0.06 + (W * 1.12) * (s / poles);
      var x1 = -W * 0.06 + (W * 1.12) * ((s + 1) / poles);
      swag(x0, x1, top, sag, perSwag, front, opts);
    }

    back = [];
    var bopts = { run: 1, index: 0, accentEvery: 0 };
    var bper = narrow ? 6 : 9;
    for (var b = 0; b < poles; b++) {
      var bx0 = -W * 0.10 + (W * 1.2) * (b / poles);
      var bx1 = -W * 0.10 + (W * 1.2) * ((b + 1) / poles);
      swag(bx0, bx1, H * 0.035, band * 0.34, bper, back, bopts);
    }
  }

  function cable(list, upto) {
    // Draw the cable swag by swag: breaking the path at each pole boundary
    // avoids a phantom line joining the end of one swag to the start of the next.
    var start = 0;
    while (start < list.length) {
      var end = start;
      while (end + 1 < list.length && list[end + 1].t > list[end].t) end++;
      ctx.beginPath();
      var moved = false;
      for (var i = start; i <= end; i++) {
        var b = list[i];
        if (b.t > upto + 0.0001) break;
        if (!moved) { ctx.moveTo(b.x, b.y); moved = true; }
        else ctx.lineTo(b.x, b.y);
      }
      if (moved) ctx.stroke();
      start = end + 1;
    }
  }

  function bulb(x, y, radius, colour, alpha, glow) {
    alpha = Math.max(0, Math.min(1, alpha));
    if (alpha <= 0.02) return;

    if (glow > 0.02) {
      var g = ctx.createRadialGradient(x, y, 0, x, y, radius * 9);
      g.addColorStop(0, 'rgba(' + colour[0] + ',' + colour[1] + ',' + colour[2] + ',' + (0.55 * glow * alpha) + ')');
      g.addColorStop(0.35, 'rgba(' + colour[0] + ',' + colour[1] + ',' + colour[2] + ',' + (0.16 * glow * alpha) + ')');
      g.addColorStop(1, 'rgba(' + colour[0] + ',' + colour[1] + ',' + colour[2] + ',0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, radius * 9, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = 'rgba(' + colour[0] + ',' + colour[1] + ',' + colour[2] + ',' + (0.92 * alpha) + ')';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(' + HOT[0] + ',' + HOT[1] + ',' + HOT[2] + ',' + (0.95 * alpha * glow) + ')';
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBack(now) {
    ctx.strokeStyle = 'rgba(11,11,12,0.13)';
    ctx.lineWidth = 1;
    cable(back, 1);
    for (var i = 0; i < back.length; i++) {
      var b = back[i];
      var sway = Math.sin(now / 4200 + b.phase) * 1.6;
      bulb(b.x, b.y + sway, 1.9, WARM, 0.34, 0.30);
    }
  }

  function drawFront(now, dt) {
    var head = null;
    for (var h = 0; h < front.length; h++) {
      if (front[h].t <= progress) head = front[h];
      else break;
    }

    ctx.strokeStyle = 'rgba(11,11,12,0.62)';
    ctx.lineWidth = 1.3;
    cable(front, progress);

    for (var k = 0; k < front.length; k++) {
      var b = front[k];
      if (b.t > progress + 0.0001) continue;
      if (b.ign < 0) b.ign = 0;
      if (b.ign < 1) b.ign = Math.min(1, b.ign + dt / 380);

      var sway2 = Math.sin(now / 3000 + b.phase) * 2.1;
      var x = b.x, y = b.y + sway2;

      var breathe = 0.80 + 0.20 * Math.sin(now / 1100 + b.phase);
      var near = Math.hypot(pointer.x - x, pointer.y - y);
      var pull = near < 210 ? (1 - near / 210) : 0;

      var radius = 5.2 * (1 + pull * 0.28);
      var alpha = breathe * b.ign + pull * 0.2;
      var glow = (0.62 + 0.38 * breathe) * b.ign + pull * 1.2;

      bulb(x, y, radius, b.colour, alpha, glow);
    }

    // The install head: where the cable is currently being pulled.
    if (head && progress > 0.001 && progress < 0.999) {
      var s = Math.sin(now / 3000 + head.phase) * 2.1;
      var spark = ctx.createRadialGradient(head.x, head.y + s, 0, head.x, head.y + s, 34);
      spark.addColorStop(0, 'rgba(255,255,255,0.98)');
      spark.addColorStop(0.3, 'rgba(255,196,110,0.62)');
      spark.addColorStop(1, 'rgba(255,196,110,0)');
      ctx.fillStyle = spark;
      ctx.beginPath();
      ctx.arc(head.x, head.y + s, 34, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function finishedFrame() {
    // A complete, strung, lit run — used for reduced motion and whenever the
    // animation loop cannot start (a backgrounded tab throttles rAF flat).
    ctx.clearRect(0, 0, W, H);
    drawBack(0);
    var keep = progress;
    progress = 1;
    for (var i = 0; i < front.length; i++) front[i].ign = 1;
    drawFront(0, 999);
    progress = keep;
    for (var j = 0; j < front.length; j++) front[j].ign = -1;
  }

  function frame(now) {
    if (watchdog) { clearTimeout(watchdog); watchdog = 0; }
    if (!startedAt) startedAt = now;
    var dt = last ? Math.min(64, now - last) : 16;
    last = now;

    if (!reduce && progress < 1) progress = Math.min(1, (now - startedAt) / INSTALL_MS);

    ctx.clearRect(0, 0, W, H);
    drawBack(now);
    drawFront(now, dt);
    raf = requestAnimationFrame(frame);
  }

  function onPointer(e) {
    var r = canvas.getBoundingClientRect();
    pointer.x = e.clientX - r.left;
    pointer.y = e.clientY - r.top;
  }

  window.addEventListener('pointermove', onPointer, { passive: true });
  window.addEventListener('pointerleave', function () { pointer.x = -9999; pointer.y = -9999; });

  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () {
      size();
      if (reduce || !startedAt) finishedFrame();
    }, 160);
  });

  size();

  if (reduce) {
    finishedFrame();
  } else {
    raf = requestAnimationFrame(frame);
    watchdog = setTimeout(function () {
      if (!startedAt) finishedFrame();
    }, 600);
  }

  window.__lightsReady = true;
})();
