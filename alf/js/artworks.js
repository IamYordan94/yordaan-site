/* /artworks — the illustration grid's companion map.

   The page used to plot twenty "exact" positions plus four departure docks. None of it
   was real: the 2026/27 route is unpublished. So the map is now what it honestly is —
   unanswered. Question marks instead of numbers, a pool of plausible canal-side spots,
   and the markers swap places every few seconds so nobody mistakes them for positions.

   The name list in the sidebar scrolls to the illustration instead of "flying" to a
   coordinate, because there is no coordinate to fly to. */
(function () {
  "use strict";

  var POOL = [
    [52.3760, 4.8990], [52.3745, 4.8925], [52.3720, 4.8895], [52.3700, 4.8880],
    [52.3680, 4.8895], [52.3665, 4.8930], [52.3650, 4.8985], [52.3660, 4.9035],
    [52.3685, 4.9060], [52.3715, 4.9070], [52.3745, 4.9065], [52.3770, 4.9020],
    [52.3785, 4.8950], [52.3770, 4.8885]
  ];
  var MARKERS = 12;
  var SWAP_MS = 5200;

  var mapEl = document.querySelector(".alf-map");
  var works = ((window.ALF_DATA || {}).artworks) || [];

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function questionIcon() {
    return L.divIcon({
      className: "alf-pin-wrap",
      html: '<span class="alf-pin alf-pin-q">?</span>',
      iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -18]
    });
  }

  var POPUP = '<span class="alf-pop-kicker">Not a position</span>' +
    '<strong>Where a work will stand</strong>' +
    '<span class="alf-pop-meta">The 2026/27 route is not published yet. This marker is a placeholder — it moves on purpose and does not point at anything.</span>';

  function place(markers, spots) {
    markers.forEach(function (mk, i) {
      var p = spots[i % spots.length];
      mk.setLatLng([p[0] + (Math.random() - 0.5) * 0.0012, p[1] + (Math.random() - 0.5) * 0.0016]);
    });
  }

  function initMap() {
    if (!mapEl || typeof L === "undefined") return;
    var map = L.map(mapEl, { scrollWheelZoom: false, zoomControl: true, attributionControl: true });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(map);
    map.fitBounds(L.latLngBounds(POOL), { padding: [40, 40] });

    var markers = [];
    var spots = shuffle(POOL.slice()).slice(0, MARKERS);
    for (var i = 0; i < MARKERS; i++) {
      var mk = L.marker([POOL[i][0], POOL[i][1]], { icon: questionIcon(), riseOnHover: true })
        .addTo(map).bindPopup(POPUP);
      markers.push(mk);
    }
    place(markers, spots);

    setInterval(function () {
      spots = shuffle(POOL.slice()).slice(0, MARKERS);
      place(markers, spots);
    }, SWAP_MS);

    setTimeout(function () { map.invalidateSize(); }, 60);
  }

  /* the name list scrolls to the illustration — there is no coordinate to fly to */
  Array.prototype.forEach.call(document.querySelectorAll("[data-goto]"), function (btn) {
    btn.addEventListener("click", function () {
      var card = document.getElementById(btn.getAttribute("data-goto"));
      if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });

  initMap();
  void works;
})();
