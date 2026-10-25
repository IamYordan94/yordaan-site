/* The lights install themselves.
   A catenary of bulbs strung across the hero: the cable draws itself,
   each bulb ignites as the cable reaches it, then the whole run breathes.
   Vanilla canvas, no dependencies, ~4KB. */

(function () {
  'use strict';

  var canvas = document.getElementById('lights');
  if (!canvas || !canvas.getContext) return;

  var ctx = canvas.getContext('2d');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var W = 0, H = 0, dpr = 1;
  var front = [], back = [];
  var progress = reduce ? 1 : 0;
  var startedAt = 0;
  var raf = 0;
  var pointer = { x: -9999, y: -9999 };

  var INSTALL_MS = 2600;       // how long the cable takes to string itself
  var WARM = [255, 214, 150];
  var ACCENT = [31, 58, 224];

  function size() {
    var rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(320, Math.round(rect.width));
    H = Math.max(220, Math.round(rect.height));
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    build();
  }

  function build() {
    var narrow = W < 700;
    var count = narrow ? 15 : 26;

    // The string the visitor watches being hung: anchored off both edges,
    // sagging into the upper third of the hero.
    front = [];
    var topY = H * (narrow ? 0.13 : 0.10);
    var sag = H * (narrow ? 0.24 : 0.30);
    for (var i = 0; i < count; i++) {
      var t = i / (count - 1);
      var x = -30 + (W + 60) * t;
      var y = topY + Math.sin(Math.PI * t) * sag;
      front.push({
        t: t,
        x: x,
        y: y,
        z: Math.sin(t * Math.PI * 2) * 0.5,
        colour: (i % 7 === 6) ? ACCENT : WARM,
        phase: Math.random() * Math.PI * 2,
        ign: -1
      });
    }

    // A second, fainter run further back. Smaller, dimmer, slower: it sells depth.
    back = [];
    var bcount = narrow ? 10 : 18;
    for (var j = 0; j < bcount; j++) {
      var bt = j / (bcount - 1);
      back.push({
        t: bt,
        x: -40 + (W + 80) * bt,
        y: H * 0.045 + Math.sin(Math.PI * bt) * H * 0.17,
        z: -1,
        colour: WARM,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  function cablePoint(list, tt) {
    // Points are already sampled along the curve; interpolate for the draw head.
    var i = Math.min(list.length - 1, Math.max(0, Math.floor(tt * (list.length - 1))));
    return list[i];
  }

  function bulb(x, y, radius, colour, alpha, glow) {
    alpha = Math.max(0, Math.min(1, alpha));
    if (alpha <= 0.01) return;

    if (glow > 0.02) {
      var g = ctx.createRadialGradient(x, y, 0, x, y, radius * 7);
      g.addColorStop(0, 'rgba(' + colour[0] + ',' + colour[1] + ',' + colour[2] + ',' + (0.42 * glow * alpha) + ')');
      g.addColorStop(0.45, 'rgba(' + colour[0] + ',' + colour[1] + ',' + colour[2] + ',' + (0.10 * glow * alpha) + ')');
      g.addColorStop(1, 'rgba(' + colour[0] + ',' + colour[1] + ',' + colour[2] + ',0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, radius * 7, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = 'rgba(' + colour[0] + ',' + colour[1] + ',' + colour[2] + ',' + (0.95 * alpha) + ')';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    // filament
    ctx.fillStyle = 'rgba(255,255,255,' + (0.85 * alpha * glow) + ')';
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.42, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBack(now) {
    ctx.strokeStyle = 'rgba(11,11,12,0.10)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var i = 0; i < back.length; i++) {
      var b = back[i];
      var sway = Math.sin(now / 3400 + b.phase) * 2.2;
      if (i === 0) ctx.moveTo(b.x, b.y + sway);
      else ctx.lineTo(b.x, b.y + sway);
    }
    ctx.stroke();

    for (var k = 0; k < back.length; k++) {
      var bb = back[k];
      var sway2 = Math.sin(now / 3400 + bb.phase) * 2.2;
      bulb(bb.x, bb.y + sway2, 1.6, WARM, 0.30, 0.25);
    }
  }

  function drawFront(now, dt) {
    var head = front[Math.min(front.length - 1,
      Math.floor(progress * (front.length - 1) + 0.001))];

    // the cable, drawn only as far as it has been strung
    ctx.strokeStyle = 'rgba(11,11,12,0.55)';
    ctx.lineWidth = 1.15;
    ctx.beginPath();
    for (var i = 0; i < front.length; i++) {
      var b = front[i];
      if (b.t > progress + 0.001) break;
      var sway = Math.sin(now / 2600 + b.t * 3.1) * 2.6;
      if (i === 0) ctx.moveTo(b.x, b.y + sway);
      else ctx.lineTo(b.x, b.y + sway);
    }
    ctx.stroke();

    for (var k = 0; k < front.length; k++) {
      var bulbRef = front[k];
      if (bulbRef.t > progress + 0.001) continue;

      if (bulbRef.ign < 0) bulbRef.ign = 0;      // reached by the cable: light it
      if (bulbRef.ign < 1) bulbRef.ign = Math.min(1, bulbRef.ign + dt / 320);

      var sway2 = Math.sin(now / 2600 + bulbRef.t * 3.1) * 2.6;
      var x = bulbRef.x;
      var y = bulbRef.y + sway2;

      var depth = 1 + bulbRef.z * 0.18;
      var radius = 3.4 * depth;

      // breathe, and lean towards the pointer
      var breathe = 0.72 + 0.22 * Math.sin(now / 900 + bulbRef.phase);
      var near = Math.hypot(pointer.x - x, pointer.y - y);
      var pull = near < 190 ? (1 - near / 190) : 0;

      var alpha = breathe * bulbRef.ign;
      var glow = (0.55 + 0.45 * breathe) * bulbRef.ign + pull * 1.1;

      bulb(x, y, radius * (1 + pull * 0.35), bulbRef.colour, alpha + pull * 0.25, glow);
    }

    // the install head: a small spark where the cable is being pulled
    if (progress > 0.001 && progress < 0.999) {
      var s = Math.sin(now / 2600 + head.t * 3.1) * 2.6;
      var spark = ctx.createRadialGradient(head.x, head.y + s, 0, head.x, head.y + s, 26);
      spark.addColorStop(0, 'rgba(255,255,255,0.95)');
      spark.addColorStop(0.35, 'rgba(255,214,150,0.55)');
      spark.addColorStop(1, 'rgba(255,214,150,0)');
      ctx.fillStyle = spark;
      ctx.beginPath();
      ctx.arc(head.x, head.y + s, 26, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  var last = 0;
  var watchdog = 0;

  function finishedFrame() {
    // Draw the strung, lit run once, synchronously. Used for reduced motion and
    // as a fallback: a backgrounded tab throttles requestAnimationFrame to a
    // standstill, and the hero must never be an empty white box because of it.
    ctx.clearRect(0, 0, W, H);
    drawBack(0);
    var keep = progress;
    progress = 1;
    for (var i = 0; i < front.length; i++) front[i].ign = 1;
    drawFront(0, 999);
    progress = keep;
  }

  function frame(now) {
    if (watchdog) { clearTimeout(watchdog); watchdog = 0; }
    if (!startedAt) startedAt = now;
    var dt = last ? Math.min(64, now - last) : 16;
    last = now;

    if (!reduce && progress < 1) {
      progress = Math.min(1, (now - startedAt) / INSTALL_MS);
    }

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
    rt = setTimeout(size, 150);
  });

  if (reduce) {
    // No animation for people who asked for none: draw the finished run once,
    // and redraw on resize.
    size();
    finishedFrame();
    window.addEventListener('resize', function () {
      size();
      finishedFrame();
    });
  } else {
    size();
    raf = requestAnimationFrame(frame);
    // If the loop has not started (backgrounded tab, throttled rAF), paint the
    // finished string so the hero is never blank.
    watchdog = setTimeout(function () {
      if (!startedAt) finishedFrame();
    }, 600);
  }

  window.__lightsReady = true;
})();
