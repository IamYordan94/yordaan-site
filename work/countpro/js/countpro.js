/* CountPro product page — the counting instrument.
   Decorative only: the column is complete in the HTML and stays readable without this file.
   Numbers enter at the bottom, rise one row at a time, and the count restarts at 200.
   Honours prefers-reduced-motion by not starting at all. */
(function () {
  "use strict";

  var STEP = 25;
  var MAX = 200;
  var SEED_ROWS = 4;
  var KEEP_ROWS = 9;
  var DWELL = 1700;
  var SLIDE = 620;
  var RESET_HOLD = 560;

  var gauge = document.querySelector("[data-gauge]");
  var list = gauge ? gauge.querySelector("[data-gauge-list]") : null;
  var meter = gauge ? gauge.querySelector("[data-gauge-meter]") : null;
  if (!gauge || !list || !meter) { return; }

  var motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var timer = null;
  var resetTimer = null;
  var rowHeight = 0;
  var value = 175;

  function makeRow(n) {
    var li = document.createElement("li");
    var num = document.createElement("span");
    num.className = "num";
    num.textContent = String(n);
    li.appendChild(num);
    return li;
  }

  function measure() {
    if (rowHeight) { return rowHeight; }
    var row = list.lastElementChild;
    rowHeight = row ? row.getBoundingClientRect().height : 0;
    return rowHeight || 48;
  }

  function paintMeter() {
    meter.style.height = ((value / MAX) * 100).toFixed(2) + "%";
  }

  function seed() {
    var rows = [];
    var i;
    list.style.transition = "none";
    list.style.transform = "translateY(0)";
    list.textContent = "";
    value = 0;
    for (i = 1; i <= SEED_ROWS; i += 1) {
      rows.push(makeRow(i * STEP));
      value = i * STEP;
    }
    for (i = 0; i < rows.length; i += 1) {
      list.appendChild(rows[i]);
    }
    paintMeter();
  }

  function slide(n) {
    var h = measure();
    list.style.transition = "none";
    list.style.transform = "translateY(" + h + "px)";
    list.appendChild(makeRow(n));
    while (list.children.length > KEEP_ROWS) {
      list.removeChild(list.firstElementChild);
    }
    /* Commit the offset before it is animated away, or the two styles collapse. */
    void list.offsetHeight;
    list.style.transition = "transform " + SLIDE + "ms cubic-bezier(.22,.61,.36,1)";
    list.style.transform = "translateY(0)";
  }

  function start() {
    if (timer || document.hidden || motion.matches) { return; }
    timer = window.setInterval(tick, DWELL);
  }

  function stop() {
    if (timer) {
      window.clearInterval(timer);
      timer = null;
    }
  }

  function reset() {
    stop();
    gauge.classList.add("is-resetting");
    resetTimer = window.setTimeout(function () {
      resetTimer = null;
      rowHeight = 0;
      seed();
      gauge.classList.remove("is-resetting");
      start();
    }, RESET_HOLD);
  }

  function tick() {
    if (value >= MAX) {
      reset();
      return;
    }
    value += STEP;
    slide(value);
    paintMeter();
  }

  function onVisibility() {
    if (document.hidden) {
      stop();
    } else if (!resetTimer) {
      start();
    }
  }

  function onMotionChange() {
    if (motion.matches) {
      stop();
    } else {
      start();
    }
  }

  paintMeter();

  if (motion.matches) { return; }

  window.addEventListener("resize", function () {
    rowHeight = 0;
  }, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);
  if (typeof motion.addEventListener === "function") {
    motion.addEventListener("change", onMotionChange);
  } else if (typeof motion.addListener === "function") {
    motion.addListener(onMotionChange);
  }

  start();
}());
