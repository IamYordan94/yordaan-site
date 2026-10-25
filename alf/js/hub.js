/* /tickets — every Light Festival cruise on both platforms, side by side.

   Why this page is not a booking wizard any more: it used to collect a date, a boat,
   guests, a name and an email, then hand the visitor to Viator or GetYourGuide where
   they had to enter all of it again. None of it carried over (we are an affiliate — the
   sale happens on the platform, in their name), so the form was theatre, paid for in the
   visitor's effort. What the page does instead is show the real offers from both
   platforms with the deepest integration each one allows:

     GetYourGuide  their own availability module: live price, live dates, and the chosen
                   date carries through to their checkout.
     Viator        their API data (photo, price, rating, departure times) on our card,
                   with a link straight into the operator's booking calendar.

   Both get the same weight. Styling lives in css/site.css under ".hub-*" — the site
   ships a compiled Tailwind, so utility classes written here would not exist. */
(function () {
  "use strict";

  var D = window.ALF_DATA || {};
  var boats = ((D.cruises || {}).boats || []);
  var host = document.getElementById("alf-hub");
  if (!boats.length || !host) return;

  var PARTNER = "KRAI3FK";
  var PLATFORM = { viator: "Viator", getyourguide: "GetYourGuide" };

  /* ------------------------------------------------------------------ helpers */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function money(cents) {
    if (cents == null) return "";
    var v = cents / 100;
    return "€" + (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2));
  }
  function duration(mins) {
    if (!mins) return "";
    if (mins < 60) return mins + " min";
    var h = Math.floor(mins / 60), m = mins % 60;
    return m ? h + " h " + m + " min" : h + " h";
  }
  function departures(o) {
    var t = o.times || [];
    if (!t.length) return "";
    if (t.length === 1) return "departs " + t[0];
    return t.length + " departures · " + t[0] + "–" + t[t.length - 1];
  }
  function gygId(url) {
    var m = String(url || "").match(/-t(\d+)/);
    return m ? m[1] : null;
  }
  function availabilityFrame(tourId) {
    return "https://widget.getyourguide.com/default/availability.frame" +
      "?partner_id=" + PARTNER + "&locale=en-GB&currency=EUR&tour_id=" + tourId;
  }
  function rating(o) {
    if (!o.rating) return "";
    return "★ " + o.rating + (o.reviews ? " · " + o.reviews.toLocaleString("en-GB") + " reviews" : "");
  }
  function rel() { return 'target="_blank" rel="sponsored noopener noreferrer"'; }
  function meta(o) {
    var bits = [];
    if (o.rating) bits.push(rating(o));
    if (o.durationMinutes) bits.push(duration(o.durationMinutes));
    return bits.length ? '<p class="hub-meta">' + bits.join(" · ") + "</p>" : "";
  }
  function note(o) {
    return o.note ? '<p class="hub-note">' + esc(o.note) + "</p>" : "";
  }

  /* -------------------------------------------------------------------- cards */
  function viatorCard(o) {
    return '' +
      '<article class="hub-card" data-provider="viator">' +
        (o.image ? '<img class="hub-card-img" src="' + esc(o.image) + '" alt="" loading="eager" referrerpolicy="no-referrer">' : "") +
        '<div class="hub-body">' +
          '<p class="label-xs hub-prov hub-prov-viator">Viator</p>' +
          '<h3 class="hub-title">' + esc(o.title) + "</h3>" +
          meta(o) + note(o) +
          '<p class="hub-foot">' +
            '<span class="hub-price">' + (o.priceFrom ? money(o.priceFrom) : "See price") + "</span>" +
            '<span class="label-xs hub-dep">' + esc(departures(o)) + "</span>" +
          "</p>" +
          '<a class="hub-cta" href="' + esc(o.url) + '" ' + rel() + ">Book on Viator</a>" +
        "</div>" +
      "</article>";
  }

  function gygCard(o) {
    var id = gygId(o.url);
    return '' +
      '<article class="hub-card" data-provider="getyourguide">' +
        '<div class="hub-body">' +
          '<p class="label-xs hub-prov hub-prov-gyg">GetYourGuide</p>' +
          '<h3 class="hub-title">' + esc(o.title) + "</h3>" +
          meta(o) + note(o) +
        "</div>" +
        (id
          ? '<div class="hub-live">' +
              '<p class="label-xs hub-live-note">Live prices and dates · your date carries through to their checkout</p>' +
              '<div class="hub-live-inner">' +
                '<iframe class="live-avail" src="' + availabilityFrame(id) + '" title="Availability on GetYourGuide" loading="eager" scrolling="no"></iframe>' +
              "</div>" +
            "</div>"
          : '<div class="hub-body hub-body-cta"><a class="hub-cta" href="' + esc(o.url) + '" ' + rel() + ">Open on GetYourGuide</a></div>") +
      "</article>";
  }

  function card(o) { return o.provider === "viator" ? viatorCard(o) : gygCard(o); }

  /* --------------------------------------------------------------- the markup */
  var blocks = boats.map(function (b) {
    var opts = (b.affiliate || {}).options || [];
    if (!opts.length) return "";
    return '' +
      '<div class="hub-block" data-boat="' + esc(b.code) + '">' +
        '<h2 class="hub-h2">' + esc(b.label) + "</h2>" +
        '<div class="hub-grid">' + opts.map(card).join("") + "</div>" +
      "</div>";
  }).join("");

  var rows = boats.map(function (b) {
    return ((b.affiliate || {}).options || []).map(function (o) {
      return '' +
        '<tr data-provider="' + esc(o.provider) + '">' +
          '<th scope="row">' + esc(o.title) + "</th>" +
          "<td>" + esc(PLATFORM[o.provider] || o.provider) + "</td>" +
          "<td>" + esc(b.label) + "</td>" +
          "<td>" + esc(duration(o.durationMinutes)) + "</td>" +
          '<td class="hub-strong">' + (o.priceFrom ? money(o.priceFrom) : "on their page") + "</td>" +
          "<td>" + (o.rating ? "★ " + o.rating : "—") + "</td>" +
          '<td><a href="' + esc(o.url) + '" ' + rel() + ">Book →</a></td>" +
        "</tr>";
    }).join("");
  }).join("");

  host.innerHTML = '' +
    '<div class="hub-filters" role="group" aria-label="Filter by platform">' +
      '<button type="button" class="hub-filter" data-filter="all">Both platforms</button>' +
      '<button type="button" class="hub-filter" data-filter="viator">Viator only</button>' +
      '<button type="button" class="hub-filter" data-filter="getyourguide">GetYourGuide only</button>' +
    "</div>" +
    blocks +
    '<h2 class="hub-h2 hub-h2-table">All of them, side by side</h2>' +
    '<div class="hub-tablewrap"><table class="hub-table"><thead><tr>' +
      '<th scope="col">Cruise</th><th scope="col">Platform</th><th scope="col">Boat</th>' +
      '<th scope="col">Length</th><th scope="col">From</th><th scope="col">Rating</th><th scope="col"></th>' +
    "</tr></thead><tbody>" + rows + "</tbody></table></div>" +
    '<p class="hub-fine">' +
      "We are an independent guide and a booking partner of both platforms — we earn a commission when you book through " +
      "these links, and it never changes what you pay. We take no bookings or payments ourselves: every button opens the " +
      "operator's own booking page, where the price, the dates and the terms are theirs. GetYourGuide prices are shown live " +
      "by them; Viator prices and departure times are read from their API every morning." +
    "</p>";

  /* ------------------------------------------------------------------ filters */
  var buttons = Array.prototype.slice.call(host.querySelectorAll(".hub-filter"));

  function apply(filter) {
    buttons.forEach(function (b) {
      b.classList.toggle("is-on", b.getAttribute("data-filter") === filter);
    });
    Array.prototype.forEach.call(host.querySelectorAll(".hub-card"), function (c) {
      c.style.display = filter === "all" || c.getAttribute("data-provider") === filter ? "" : "none";
    });
    Array.prototype.forEach.call(host.querySelectorAll("tbody tr"), function (r) {
      r.style.display = filter === "all" || r.getAttribute("data-provider") === filter ? "" : "none";
    });
    Array.prototype.forEach.call(host.querySelectorAll(".hub-block"), function (b) {
      var any = Array.prototype.some.call(b.querySelectorAll(".hub-card"), function (c) {
        return c.style.display !== "none";
      });
      b.style.display = any ? "" : "none";
    });
  }

  buttons.forEach(function (b) {
    b.addEventListener("click", function () { apply(b.getAttribute("data-filter")); });
  });
  apply("all");

  /* The GetYourGuide module is designed for a column around 560px wide: below that it
     stacks and fits, above ~620 it lays out a two-column card that overflows its frame by
     249px (measured at 620/700/800/916/1000/1100/1240/1400). So it gets a fixed 560px
     column, centred, on any screen wide enough; on a phone it takes the full width and the
     frame is given the extra height its stacked layout needs. */
})();
