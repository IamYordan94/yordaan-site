/* /ticket/:reference — reads the booking that tickets.js stored and renders the ticket.
   No server: the reference is looked up in this browser's localStorage. */
(function () {
  "use strict";

  var C = (window.ALF_DATA || {}).cruises || {};
  var boats = C.boats || [];
  var docks = C.docks || [];
  var addons = C.addons || [];

  var loading = document.getElementById("alf-loading");
  var notFound = document.getElementById("alf-notfound");
  var ticketBox = document.getElementById("alf-ticket");
  var tips = document.getElementById("alf-tips");
  var refLine = document.getElementById("alf-ref");
  if (!ticketBox) return;

  var money = function (cents) {
    return new Intl.NumberFormat("en-NL", { style: "currency", currency: "EUR" }).format((cents || 0) / 100);
  };
  var dateLabel = function (iso) {
    if (!iso) return "";
    return new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", {
      weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC"
    });
  };
  var addMinutes = function (time, mins) {
    if (!time) return "";
    var p = time.split(":");
    var t = Number(p[0]) * 60 + Number(p[1]) + (mins || 0);
    return String(Math.floor(t / 60) % 24).padStart(2, "0") + ":" + String(t % 60).padStart(2, "0");
  };
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  };
  function icon(name, size, cls) {
    var paths = {
      clock: '<circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path>',
      ship: '<path d="M12 10.189V14"></path><path d="M12 2v3"></path><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"></path><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-8.188-3.639a2 2 0 0 0-1.624 0L3 14a11.6 11.6 0 0 0 2.81 7.76"></path><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1s1.2 1 2.5 1c2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"></path>',
      "map-pin": '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"></path><circle cx="12" cy="10" r="3"></circle>',
      users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><path d="M16 3.128a4 4 0 0 1 0 7.744"></path><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><circle cx="9" cy="7" r="4"></circle>'
    };
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-' + name + (cls ? " " + cls : "") + '" aria-hidden="true">' + (paths[name] || "") + "</svg>";
  }

  /* reference: /ticket/ALF-XXXXXX (or ticket.html?ref=ALF-XXXXXX) */
  function readReference() {
    var q = new URLSearchParams(window.location.search).get("ref");
    if (q) return q.trim().toUpperCase();
    var seg = window.location.pathname.replace(/\/+$/, "").split("/").pop() || "";
    if (/^alf-/i.test(seg)) return seg.toUpperCase();
    return "";
  }

  /* Fallback: the newest booking this browser holds. Cloudflare Pages rewrites
     /ticket/<reference> to /ticket, so the reference can go missing from the URL. */
  function latestReference() {
    try {
      var all = JSON.parse(localStorage.getItem("alf-bookings") || "{}");
      var keys = Object.keys(all);
      if (!keys.length) return "";
      keys.sort(function (a, b) { return String(all[b].createdAt || "").localeCompare(String(all[a].createdAt || "")); });
      return keys[0];
    } catch (e) { return ""; }
  }

  function lookup(reference) {
    try {
      var all = JSON.parse(localStorage.getItem("alf-bookings") || "{}");
      return all[reference] || null;
    } catch (e) {
      return null;
    }
  }

  function detail(label, valueHtml, iconName) {
    return '<div class="flex gap-4"><span class="mt-1 shrink-0 text-magenta">' + icon(iconName, 16) + "</span>" +
      '<div><p class="label-xs text-paper/45">' + label + '</p><p class="mt-2 text-lg leading-snug text-paper">' + valueHtml + "</p></div></div>";
  }

  function renderTicket(booking) {
    var b = boats.filter(function (x) { return x.code === booking.boatCode; })[0] || null;
    var d = docks.filter(function (x) { return x.code === booking.dockCode; })[0] || null;
    var chosen = (booking.addonCodes || []).map(function (code) {
      return addons.filter(function (a) { return a.code === code; })[0];
    }).filter(Boolean);

    var dep = esc(dateLabel(booking.date)) + "<br>" + esc(booking.time) +
      (b ? "–" + addMinutes(booking.time, b.durationMinutes) + " (" + b.durationMinutes + " min)" : "");
    var guestsText = booking.adults + " adult" + (booking.adults === 1 ? "" : "s") +
      (booking.children > 0 ? ", " + booking.children + " child" + (booking.children === 1 ? "" : "ren") : "") +
      '<br><span class="text-paper/60">' + esc(booking.name || "") + "</span>";
    var dockHtml = d ? esc(d.name) + '<br><span class="text-paper/60">' + esc(d.address) + "</span>" : "—";
    var routeHtml = b ? esc(b.route) + '<br><span class="text-paper/60">' + esc(b.kind) + "</span>" : "—";

    var addonBlock = chosen.length
      ? '<div class="md:col-span-2"><p class="label-xs text-paper/45">Add-ons</p><ul class="mt-3 flex flex-wrap gap-3">' +
        chosen.map(function (a) { return '<li class="label-xs border-2 border-mint px-4 py-3 text-mint">' + esc(a.name) + "</li>"; }).join("") +
        "</ul></div>"
      : "";

    ticketBox.innerHTML =
      '<div class="border-2 border-paper/20 bg-[#0c1238]">' +
      '<div class="flex flex-wrap items-center justify-between gap-4 border-b-2 border-dashed border-paper/25 px-6 py-6 md:px-10">' +
      '<div><p class="label-xs text-mint">Amsterdam Light Festival 2026</p>' +
      '<p class="headline mt-3 text-2xl md:text-3xl">' + esc(b ? b.name : "Canal cruise") + "</p></div>" +
      '<div class="text-right"><p class="label-xs text-paper/45">Reference</p>' +
      '<p class="mt-2 font-display text-3xl text-magenta">' + esc(booking.reference) + "</p></div></div>" +
      '<div class="grid gap-8 px-6 py-8 md:grid-cols-2 md:px-10 md:py-10">' +
      detail("Departure", dep, "clock") +
      detail("Dock", dockHtml, "map-pin") +
      detail("Guests", guestsText, "users") +
      detail("Route", routeHtml, "ship") +
      addonBlock +
      "</div>" +
      '<div class="flex flex-wrap items-center justify-between gap-4 border-t-2 border-dashed border-paper/25 px-6 py-7 md:px-10">' +
      '<p class="label-xs text-paper/50">Total paid (simulated)</p>' +
      '<p class="font-display text-4xl text-mint">' + money(booking.totalCents) + "</p></div></div>";

    ticketBox.hidden = false;
    if (tips) tips.hidden = false;
  }

  function renderNotFound(reference) {
    if (refLine) refLine.textContent = reference || "ALF-••••••";
    notFound.hidden = false;
    if (tips) tips.hidden = true;
  }

  var reference = readReference() || latestReference();
  if (refLine && reference) refLine.textContent = reference;
  var booking = reference ? lookup(reference) : null;

  /* short pause so the loading state is visible exactly like the original */
  setTimeout(function () {
    if (loading) loading.hidden = true;
    if (booking) renderTicket(booking);
    else renderNotFound(reference);
  }, 350);

  var findForm = document.getElementById("alf-find");
  if (findForm) {
    findForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var input = document.getElementById("alf-find-input");
      var value = (input && input.value || "").trim().toUpperCase();
      if (!value) return;
      window.location.href = "ticket.html?ref=" + encodeURIComponent(value);
    });
  }
})();
