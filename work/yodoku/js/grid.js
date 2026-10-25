/* Yodoku product page — two things only.
   1. The hero board: a 7x7 grid that fills one cell at a time, holds, clears, repeats.
   2. The seven mode boards: the same grid, filled as seven different subsets.
   No dependencies, no network. */

(function () {
  'use strict';

  /* ---------- the seven fill patterns ----------
     Seven rows of seven characters. '1' fills a cell, '2' fills it in ink,
     '0' leaves it empty. These are diagrams, not screenshots. */
  var PATTERNS = {
    string: ['1111111', '0000001', '1111111', '1000000', '1111111', '0000001', '1111111'],
    ladder: ['1000000', '1100000', '0110000', '0011000', '0001100', '0000110', '0000011'],
    pool:   ['0000000', '0000000', '0000000', '0000000', '0111110', '1111111', '1111111'],
    order:  ['0010000', '0000010', '1000000', '0001000', '0000001', '0100000', '0000100'],
    fermi:  ['1111111', '1000001', '1011101', '1010101', '1011101', '1000001', '1111111'],
    quiz:   ['1010101', '0000000', '1010101', '0000000', '1010101', '0000000', '1010101'],
    seven:  ['0000000', '0000000', '0000000', '1112111', '0000000', '0000000', '0000000']
  };

  var modeBoards = document.querySelectorAll('[data-pattern]');
  Array.prototype.forEach.call(modeBoards, function (board) {
    var rows = PATTERNS[board.getAttribute('data-pattern')];
    if (!rows || rows.length !== 7) return;
    var markup = '';
    for (var r = 0; r < 7; r += 1) {
      for (var c = 0; c < 7; c += 1) {
        var ch = rows[r].charAt(c);
        var cls = ch === '1' ? 'cell on' : (ch === '2' ? 'cell on mid' : 'cell');
        markup += '<span class="' + cls + '"></span>';
      }
    }
    board.innerHTML = markup;
  });

  /* ---------- the hero board ---------- */
  var canvas = document.getElementById('board-canvas');
  var countEl = document.getElementById('board-count');
  var stateEl = document.getElementById('board-state');
  var reduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;

  var N = 7;
  var CELL_MS = 66;
  var FADE_MS = 140;
  var HOLD_MS = 1500;
  var CLEAR_MS = 260;
  var GAP_MS = 650;

  var ORDER = [];
  var d;
  var r;
  var c;
  for (d = 0; d < N * 2 - 1; d += 1) {
    for (r = 0; r < N; r += 1) {
      c = d - r;
      if (c >= 0 && c < N) ORDER.push([r, c]);
    }
  }

  var FILL_END = ORDER.length * CELL_MS;
  var CLEAR_START = FILL_END + HOLD_MS;
  var CLEAR_END = CLEAR_START + CLEAR_MS;
  var CYCLE = CLEAR_END + GAP_MS;
  var STATIC_AT = FILL_END + HOLD_MS / 2;

  var size = 0;
  var raf = 0;
  var origin = 0;
  var lastCount = -1;
  var lastState = '';

  function reduced() {
    return !!(reduce && reduce.matches);
  }

  function elapsedNow() {
    if (reduced()) return STATIC_AT;
    if (!origin) return 0;
    return (window.performance.now() - origin) % CYCLE;
  }

  function paint(elapsed) {
    if (!ctx || !size) return;

    var step = size / N;
    var i;
    var cell;
    var alpha;
    var shown = 0;
    var state;

    if (elapsed < FILL_END) {
      state = 'filling';
    } else if (elapsed < CLEAR_START) {
      state = 'solved';
    } else if (elapsed < CLEAR_END) {
      state = 'clearing';
    } else {
      state = 'resetting';
    }

    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#1f3ae0';

    for (i = 0; i < ORDER.length; i += 1) {
      var starts = i * CELL_MS;
      if (elapsed < starts) break;
      alpha = Math.min(1, (elapsed - starts) / FADE_MS);
      if (elapsed >= CLEAR_START) {
        alpha *= Math.max(0, 1 - (elapsed - CLEAR_START) / CLEAR_MS);
        if (elapsed >= CLEAR_END) alpha = 0;
      }
      if (alpha <= 0) continue;
      if (alpha >= 0.5) shown += 1;
      cell = ORDER[i];
      ctx.globalAlpha = alpha;
      ctx.fillRect(cell[1] * step, cell[0] * step, step + 0.5, step + 0.5);
    }

    ctx.globalAlpha = 1;

    /* hairline rules last, so the grid stays legible over the fill */
    ctx.strokeStyle = '#e2e2e6';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (i = 0; i <= N; i += 1) {
      var p = Math.round(i * step) + 0.5;
      if (i === N) p = size - 0.5;
      ctx.moveTo(p, 0.5);
      ctx.lineTo(p, size - 0.5);
      ctx.moveTo(0.5, p);
      ctx.lineTo(size - 0.5, p);
    }
    ctx.stroke();

    if (countEl && shown !== lastCount) {
      lastCount = shown;
      countEl.textContent = (shown < 10 ? '0' : '') + shown;
    }
    if (stateEl && state !== lastState) {
      lastState = state;
      stateEl.textContent = state;
    }
  }

  function frame(now) {
    paint(((now - origin) % CYCLE + CYCLE) % CYCLE);
    raf = window.requestAnimationFrame(frame);
  }

  function resize() {
    if (!ctx) return;
    var box = canvas.getBoundingClientRect();
    var next = Math.max(80, Math.round(box.width || 320));
    var ratio = Math.min(window.devicePixelRatio || 1, 2.5);
    size = next;
    canvas.width = Math.round(next * ratio);
    canvas.height = Math.round(next * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    paint(elapsedNow());
  }

  function start() {
    if (!ctx) return;
    window.cancelAnimationFrame(raf);
    origin = window.performance.now();
    resize();
    if (reduced()) {
      paint(STATIC_AT);
      return;
    }
    raf = window.requestAnimationFrame(frame);
  }

  if (ctx) {
    start();

    if (window.ResizeObserver) {
      new window.ResizeObserver(function () {
        resize();
      }).observe(canvas);
    } else {
      window.addEventListener('resize', resize);
    }

    if (reduce) {
      var onPreferenceChange = function () {
        start();
      };
      if (reduce.addEventListener) {
        reduce.addEventListener('change', onPreferenceChange);
      } else if (reduce.addListener) {
        reduce.addListener(onPreferenceChange);
      }
    }
  }
})();
