/* /route — the same honest map as the artworks page: question marks that move.

   The festival's route for the new edition is unpublished, so this map deliberately has
   nothing to plot. Markers carry question marks, a pool of plausible canal-side spots is
   used as scenery, and the markers swap places every few seconds so nobody mistakes them
   for positions. Popups say exactly that. */

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

  var mapEl = document.querySelector("[data-unknown-map]");

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

  function init() {
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
      markers.push(
        L.marker([POOL[i][0], POOL[i][1]], { icon: questionIcon(), riseOnHover: true })
          .addTo(map).bindPopup(POPUP)
      );
    }
    place(markers, spots);

    setInterval(function () {
      spots = shuffle(POOL.slice()).slice(0, MARKERS);
      place(markers, spots);
    }, SWAP_MS);

    setTimeout(function () { map.invalidateSize(); }, 60);
  }

  init();
})();
