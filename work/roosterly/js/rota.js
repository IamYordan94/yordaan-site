/* Rosterly — the week view builds itself.
   A rota is filled in the order it is written: Monday first, crew by crew,
   across to Sunday. It holds, the uncovered shift shows up, then it clears.
   Vanilla JS, no dependencies. Honours prefers-reduced-motion. */

(function () {
  'use strict';

  var grid = document.getElementById('rota');
  if (!grid) return;

  var DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  var CREWS = ['Crew 1', 'Crew 2', 'Crew 3', 'Crew 4'];

  /* shifts[crew][day]: hours as written on a rota, or null for a day off. */
  var SHIFTS = [
    ['07\u201315', '07\u201315', null, '07\u201315', '07\u201315', '09\u201313', null],
    ['15\u201323', '15\u201323', '15\u201323', '15\u201323', null, null, '15\u201323'],
    ['11\u201319', null, '11\u201319', '11\u201319', '11\u201319', '11\u201319', null],
    [null, '19\u201323', null, '19\u201323', '19\u201323', '19\u201323', null]
  ];

  /* The one cell that has nobody on it and should not. */
  var GAP = { crew: 0, day: 6 };

  var STEP = 120;        // ms between blocks dropping in
  var GAP_AT = 520;      // ms after the last block, before the gap shows
  var HOLD = 1850;       // ms to sit with a finished week
  var RESTART = 700;     // ms after clearing, before it starts again

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var timers = [];
  var cells = [];
  var blocks = [];
  var gapFlag = null;
  var looping = false;

  function make(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function later(ms, fn) {
    timers.push(window.setTimeout(fn, ms));
  }

  function stopTimers() {
    for (var i = 0; i < timers.length; i++) window.clearTimeout(timers[i]);
    timers = [];
  }

  function build() {
    var stale = grid.querySelector('.rota-noscript');
    if (stale) stale.parentNode.removeChild(stale);

    grid.appendChild(make('div', 'r-corner', 'crew'));

    for (var d = 0; d < DAYS.length; d++) {
      grid.appendChild(make('div', 'r-day', DAYS[d]));
    }

    for (var c = 0; c < CREWS.length; c++) {
      grid.appendChild(make('div', 'r-crew', CREWS[c]));
      cells[c] = [];
      for (var day = 0; day < DAYS.length; day++) {
        var cell = make('div', 'r-cell');
        cells[c][day] = cell;
        grid.appendChild(cell);
      }
    }

    /* Filled day by day, left to right, as the week is written. */
    for (var dd = 0; dd < DAYS.length; dd++) {
      for (var cc = 0; cc < CREWS.length; cc++) {
        var hours = SHIFTS[cc][dd];
        if (!hours) continue;
        var block = make('div', 'shift');
        block.appendChild(make('span', '', hours));
        cells[cc][dd].appendChild(block);
        blocks.push(block);
      }
    }

    gapFlag = make('div', 'gap-flag', 'gap');
    cells[GAP.crew][GAP.day].appendChild(gapFlag);

    grid.classList.add('is-built');
  }

  function reset() {
    for (var i = 0; i < blocks.length; i++) blocks[i].classList.remove('is-in');
    if (gapFlag) gapFlag.classList.remove('is-in');
  }

  function play() {
    stopTimers();
    reset();

    for (var i = 0; i < blocks.length; i++) {
      (function (block, index) {
        later(index * STEP, function () { block.classList.add('is-in'); });
      })(blocks[i], i);
    }

    var done = blocks.length * STEP;

    later(done + GAP_AT, function () {
      if (gapFlag) gapFlag.classList.add('is-in');
    });

    later(done + HOLD, reset);
    later(done + HOLD + RESTART, play);
  }

  build();

  if (reduce) {
    /* No loop: the finished week, held still. */
    for (var b = 0; b < blocks.length; b++) blocks[b].classList.add('is-in');
    if (gapFlag) gapFlag.classList.add('is-in');
    looping = false;
  } else {
    looping = true;
    play();
  }

  /* A background tab throttles timers, which would freeze the rota half-built.
     Start a clean cycle when the page comes back. */
  document.addEventListener('visibilitychange', function () {
    if (looping && !document.hidden) play();
  });
})();
