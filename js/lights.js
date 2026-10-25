/* The lights install themselves.
   Festoon swags strung above the headline: the cable is pulled across, each bulb
   ignites as the cable reaches it, then the whole run breathes and leans towards
   the pointer. Vanilla canvas, no dependencies.

   Two rules learned the hard way:
   1. The scene lives in its own band. Drawn across the type it read as a stray
      hairline, so the hero reserves space for it instead.
   2. A backgrounded tab throttles requestAnimationFrame to a standstill. Mixing
      a fallback paint with a half-stalled loop left three bulbs on screen, so
      once the loop is judged dead the scene switches to a static finished run
      and stays there until the tab is visible again. */

(function () {
  'use strict';

  var canvas = document.getElementById('lights');
  if (!canvas || !canvas.getContext) return;

  var ctx = canvas.getContext('2d');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var W = 0, H = 0, dpr = 1;
  var front = [], back = [];
  var progress = 0;
  var startedAt = 0, last = 0, watchdog = 0;
  var staticMode = reduce;       // draw the finished run, no animation
  var pointer = { x: -9999, y: -9999 };

  var INSTALL_MS = 3200;
  var WARM = [232, 132, 18];     // saturared amber: reads on white
  var CORE = [255, 246, 224];
  var ACCENT = [31, 58, 224];
  var STEM = 'rgba(11,11,12,';

  function size() {
    var rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(320, Math.round(rect.width));
    H = Math.max(180, Math.round(rect.height));
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    build();
  }

  function build() {
    var narrow = W < 700;
    var top = H * (narrow ? 0.16 : 0.18);
    var sag = H * (narrow ? 0.34 : 0.42);
    var poles = narrow ? 3 : 4;
    var perSwag = narrow ? 6 : 9;

    front = [];
    var index = 0;
    for (var s = 0; s < poles; s++) {
      var x0 = -W * 0.06 + (W * 1.12) * (s / poles);
      var x1 = -W * 0.06 + (W * 1.12) * ((s + 1) / poles);
      for (var i = 0; i < perSwag; i++) {
        var t = i / (perSwag - 1);
        front.push({
          x: x0 + (x1 - x0) * t,
          y: top + Math.sin(Math.PI * t) * sag,
          t: t,
          colour: (index % 7 === 6) ? ACCENT : WARM,
          phase: Math.random() * Math.PI * 2,
          ign: 0,
          swag: s
        });
        index++;
      }
    }

    // A fainter run further back sells the depth.
    back = [];
    var bpoles = narrow ? 2 : 3;
    for (var b = 0; b < bpoles; b++) {
      var bx0 = -W * 0.12 + (W * 1.24) * (b / bpoles);
      var bx1 = -W * 0.12 + (W * 1.24) * ((b + 1) / bpoles);
      for (var j = 0; j < (narrow ? 5 : 7); j++) {
        var bt = j / ((narrow ? 5 : 7) - 1);
        back.push({
          x: bx0 + (bx1 - bx0) * bt,
          y: H * 0.05 + Math.sin(Math.PI * bt) * H * 0.16,
          t: bt,
          swag: b,
          phase: Math.random() * Math.PI * 2
        });
      }
    }
  }

  // Draw the cable swag by swag; a single path would join the end of one swag
  // to the start of the next with a phantom line.
  function cable(list, upto) {
    var start = 0;
    while (start < list.length) {
      var end = start;
      while (end + 1 < list.length && list[end + 1].swag === list[end].swag) end++;
      ctx.beginPath();
      var moved = false;
      for (var i = start; i <= end; i++) {
        var p = list[i];
        if (p.t > upto + 0.0001) break;
        if (!moved) { ctx.moveTo(p.x, p.y); moved = true; }
        else ctx.lineTo(p.x, p.y);
      }
      if (moved) ctx.stroke();
      start = end + 1;
    }
  }

  function drawBulb(x, y, radius, colour, alpha, glow, stemFrom) {
    if (alpha <= 0.02) return;

    if (stemFrom !== null && alpha > 0.15) {
      ctx.strokeStyle = STEM + (0.55 * alpha) + ')';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x, stemFrom);
      ctx.lineTo(x, y - radius * 0.9);
      ctx.stroke();

      // the socket: a small dark collar where the bulb meets the drop wire
      ctx.fillStyle = STEM + (0.75 * alpha) + ')';
      ctx.beginPath();
      ctx.ellipse(x, y - radius * 0.92, radius * 0.38, radius * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // a soft ground shadow under the fitting, so the bulb has weight
    if (alpha > 0.2) {
      var sh = ctx.createRadialGradient(x, y + radius * 1.9, 0, x, y + radius * 1.9, radius * 1.7);
      sh.addColorStop(0, 'rgba(11,11,12,' + (0.10 * alpha) + ')');
      sh.addColorStop(1, 'rgba(11,11,12,0)');
      ctx.fillStyle = sh;
      ctx.beginPath();
      ctx.ellipse(x, y + radius * 1.9, radius * 1.7, radius * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    if (glow > 0.02) {
      var g = ctx.createRadialGradient(x, y, radius * 0.5, x, y, radius * 3.4);
      g.addColorStop(0, 'rgba(' + colour[0] + ',' + colour[1] + ',' + colour[2] + ',' + (0.55 * glow * alpha) + ')');
      g.addColorStop(0.55, 'rgba(' + colour[0] + ',' + colour[1] + ',' + colour[2] + ',' + (0.14 * glow * alpha) + ')');
      g.addColorStop(1, 'rgba(' + colour[0] + ',' + colour[1] + ',' + colour[2] + ',0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, radius * 3.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // the bulb body: solid, so it reads as an object rather than a bloom
    ctx.fillStyle = 'rgba(' + colour[0] + ',' + colour[1] + ',' + colour[2] + ',' + alpha + ')';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    // filament
    ctx.fillStyle = 'rgba(' + CORE[0] + ',' + CORE[1] + ',' + CORE[2] + ',' + (0.92 * alpha) + ')';
    ctx.beginPath();
    ctx.arc(x - radius * 0.18, y - radius * 0.18, radius * 0.42, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBack(now) {
    ctx.strokeStyle = 'rgba(11,11,12,0.15)';
    ctx.lineWidth = 1;
    cable(back, 1);
    for (var i = 0; i < back.length; i++) {
      var b = back[i];
      var sway = Math.sin(now / 4200 + b.phase) * 1.5;
      drawBulb(b.x, b.y + sway + 7, 3.2, WARM, 0.34, 0.3, b.y + sway);
    }
  }

  function drawFront(now, dt) {
    var head = null;
    var reach = staticMode ? 1 : progress;

    ctx.strokeStyle = 'rgba(11,11,12,0.62)';
    ctx.lineWidth = 1.4;
    cable(front, reach);

    for (var k = 0; k < front.length; k++) {
      var b = front[k];
      if (b.t > reach + 0.0001) continue;
      if (b.ign < 1) b.ign = Math.min(1, b.ign + (staticMode ? 1 : dt / 260));
      head = b;

      var sway2 = Math.sin(now / 3000 + b.phase) * 1.9;
      var cableY = b.y + sway2;
      var by = cableY + 11;

      var breathe = 0.86 + 0.14 * Math.sin(now / 1300 + b.phase);
      var near = Math.hypot(pointer.x - b.x, pointer.y - by);
      var pull = near < 190 ? (1 - near / 190) : 0;

      var radius = 6.4 * (1 + pull * 0.22);
      var alpha = Math.min(1, breathe * b.ign + pull * 0.25);
      var glow = (0.7 + 0.3 * breathe) * b.ign + pull;

      drawBulb(b.x, by, radius, b.colour, alpha, glow, cableY);
    }

    // the install head: where the cable is being pulled
    if (head && !staticMode && progress > 0.001 && progress < 0.999) {
      var s = Math.sin(now / 3000 + head.phase) * 1.9;
      var spark = ctx.createRadialGradient(head.x, head.y + s, 0, head.x, head.y + s, 26);
      spark.addColorStop(0, 'rgba(255,255,255,0.98)');
      spark.addColorStop(0.3, 'rgba(255,190,100,0.6)');
      spark.addColorStop(1, 'rgba(255,190,100,0)');
      ctx.fillStyle = spark;
      ctx.beginPath();
      ctx.arc(head.x, head.y + s, 26, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function render(now, dt) {
    ctx.clearRect(0, 0, W, H);
    drawBack(now);
    drawFront(now, dt || 16);
  }

  function goStatic() {
    staticMode = true;
    for (var i = 0; i < front.length; i++) front[i].ign = 1;
    progress = 1;
    render(0, 16);
  }

  function frame(now) {
    if (!startedAt) startedAt = now;
    var dt = last ? Math.min(64, now - last) : 16;
    last = now;

    if (!staticMode) {
      progress = Math.min(1, (now - startedAt) / INSTALL_MS);
      if (progress >= 1) for (var i = 0; i < front.length; i++) front[i].ign = 1;
    }

    render(now, dt);
    requestAnimationFrame(frame);
  }

  window.addEventListener('pointermove', function (e) {
    var r = canvas.getBoundingClientRect();
    pointer.x = e.clientX - r.left;
    pointer.y = e.clientY - r.top;
  }, { passive: true });
  window.addEventListener('pointerleave', function () { pointer.x = -9999; pointer.y = -9999; });

  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () { size(); render(performance.now(), 16); }, 160);
  });

  document.addEventListener('visibilitychange', function () {
    // Coming back to a tab whose loop was throttled: show the finished run.
    if (!document.hidden && staticMode) render(performance.now(), 16);
  });

  size();

  if (reduce) {
    goStatic();
  } else {
    requestAnimationFrame(frame);
    // If the loop never really runs (hidden tab), settle on the finished run.
    watchdog = setTimeout(function () {
      if (progress < 0.05) goStatic();
    }, 800);
  }

  window.__lightsReady = true;
})();
