/* Programme: an index + stage that replaces the auto-scrolling rail.
   The list is the navigation; the image follows the visitor. No autoplay, nothing
   moves on its own. Built from ALF_DATA so the section can never drift out of sync
   with the artwork data; if the data or JS is missing, the <noscript> grid stays. */
(function () {
  "use strict";

  var host = document.querySelector("[data-programme]");
  if (!host) return;
  var data = window.ALF_DATA && window.ALF_DATA.artworks;
  if (!data || !data.length) return;

  var works = data.slice().sort(function (a, b) { return a.id - b.id; });
  var total = works.length;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var current = 0;
  var first = true;           // the first paint must fill the meta even though i === current
  var layers = [0, 1];        // the two crossfading image layers
  var front = 0;              // which layer is currently visible

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  var CHEV_L = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"></path></svg>';
  var CHEV_R = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg>';

  /* ---------------------------------------------------------------- markup */
  var rows = works.map(function (w, i) {
    return '<li class="pg-item">' +
      '<button type="button" class="pg-row" role="tab" id="pg-tab-' + i + '" data-i="' + i + '"' +
      ' aria-selected="' + (i === 0) + '" aria-controls="pg-panel" tabindex="' + (i === 0 ? "0" : "-1") + '">' +
        '<span class="pg-text">' +
          '<span class="pg-name">' + esc(w.title) + '</span>' +
          '<span class="pg-who">AI illustration</span>' +
        '</span>' +
      '</button></li>';
  }).join("");

  function frame(i) {
    var w = works[i];
    // both layers eager: the second one becomes visible mid-crossfade, and a lazy image
    // there stalls exactly when the visitor is waiting for it
    return '<div class="pg-frame duotone bg-' + esc(w.tone) + (i === 0 ? " is-on" : "") + '" data-layer="' + i + '">' +
      '<img src="' + esc(w.image.replace(/^\//, "")) + '" alt="' + esc(w.title) + ' — AI illustration" loading="eager" decoding="async">' +
      '<div class="duotone-floor"></div></div>';
  }

  host.className = host.className.replace(/\breveal\b/, "").trim();
  host.innerHTML =
    '<div class="pg">' +
      '<div class="pg-stage">' +
        '<div class="pg-frames" id="pg-panel" role="tabpanel" aria-labelledby="pg-tab-0">' +
          frame(0) + frame(1 % total) +
          '<div class="pg-nav">' +
            '<button type="button" class="pg-arrow" data-pg-prev aria-label="Previous work">' + CHEV_L + '</button>' +
            '<button type="button" class="pg-arrow" data-pg-next aria-label="Next work">' + CHEV_R + '</button>' +
          '</div>' +
          '<p class="pg-count"><span data-pg-current>1</span><span class="pg-sep">/</span>' + total + '</p>' +
          '<p class="pg-hint">Use ← → or scroll the list</p>' +
        '</div>' +
        '<div class="pg-meta">' +
          '<h3 class="pg-title" data-pg-title></h3>' +
          '<p class="pg-sub" data-pg-sub></p>' +
          '<p class="pg-desc" data-pg-desc></p>' +
          '<a class="pg-link" data-pg-link href="artworks.html#stop-1">See the illustrations<span aria-hidden="true"> →</span></a>' +
        '</div>' +
      '</div>' +
      '<div class="pg-index-wrap">' +
        '<p class="pg-index-label">All ' + total + ' illustrations</p>' +
        '<ol class="pg-index" role="tablist" aria-label="All ' + total + ' illustrations" aria-orientation="vertical">' + rows + '</ol>' +
      '</div>' +
    '</div>';

  /* ------------------------------------------------------------- behaviour */
  var frames = host.querySelectorAll(".pg-frame");
  var tabs = host.querySelectorAll(".pg-row");
  var elTitle = host.querySelector("[data-pg-title]");
  var elSub = host.querySelector("[data-pg-sub]");
  var elDesc = host.querySelector("[data-pg-desc]");
  var elLink = host.querySelector("[data-pg-link]");
  var elCount = host.querySelector("[data-pg-current]");
  var preloaded = {};

  function preload(i) {
    var w = works[(i + total) % total];
    if (!w || preloaded[w.image]) return;
    preloaded[w.image] = true;
    var im = new Image();
    im.src = w.image.replace(/^\//, "");
  }

  function show(i, focusRow) {
    i = (i + total) % total;
    var swap = i !== current;
    if (!swap && !first) { if (focusRow) tabs[i].focus(); return; }

    var w = works[i];
    if (swap) {
      var back = layers[1 - front];
      var incoming = frames[back];
      incoming.className = "pg-frame duotone bg-" + w.tone;
      var img = incoming.querySelector("img");
      img.loading = "eager";
      img.src = w.image.replace(/^\//, "");
      img.alt = w.title + " — AI illustration";

      frames[front].classList.remove("is-on");
      incoming.classList.add("is-on");
      front = back;
    }
    current = i;
    first = false;

    works.forEach(function (_, n) {
      tabs[n].setAttribute("aria-selected", n === i ? "true" : "false");
      tabs[n].tabIndex = n === i ? 0 : -1;
    });
    elTitle.textContent = w.title;
    elSub.textContent = "AI illustration, made for this guide";
    elDesc.textContent = "Not a photograph of a real work, and it stands nowhere on the canals. " +
      "The festival publishes its own line-up closer to the opening.";
    elCount.textContent = String(i + 1);
    elLink.href = "artworks.html#stop-" + w.id;
    host.querySelector(".pg-frames").setAttribute("aria-labelledby", "pg-tab-" + i);

    preload(i + 1);
    preload(i - 1);
    if (focusRow) tabs[i].focus();
    if (tabs[i].scrollIntoView) tabs[i].scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  host.addEventListener("click", function (e) {
    var row = e.target.closest(".pg-row");
    if (row) { show(Number(row.dataset.i), false); return; }
    if (e.target.closest("[data-pg-prev]")) { show(current - 1, false); return; }
    if (e.target.closest("[data-pg-next]")) { show(current + 1, false); return; }
  });

  host.addEventListener("keydown", function (e) {
    var keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    if (keys[e.key]) {
      e.preventDefault();
      show(current + keys[e.key], true);
    } else if (e.key === "Home") { e.preventDefault(); show(0, true); }
    else if (e.key === "End") { e.preventDefault(); show(total - 1, true); }
  });

  if (reduce) {
    // no crossfade, just swap
    host.querySelectorAll(".pg-frame").forEach(function (f) { f.style.transition = "none"; });
  }

  show(0, false);
})();
