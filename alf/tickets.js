/* /tickets — the 4-step booking wizard.
   The original talked to a server (availability, seat counts, quote, booking records).
   This static rebuild does the same arithmetic in the browser: seat counts are derived
   deterministically from date + time + boat, prices come from the same price list, and a
   confirmed booking is stored in localStorage and shown on ticket.html. */
(function () {
  "use strict";

  var C = (window.ALF_DATA || {}).cruises || {};
  var boats = C.boats || [];
  var docks = C.docks || [];
  var addons = C.addons || [];
  var slots = C.slots || [];
  var dates = C.dates || [];
  /* Booking partners (affiliate mode). Fill these in js/data.js to switch the last step
     from the built-in demo booking to a hand-off to the real product page. */
  var partners = C.partners || {};
  var PARTNER_NAMES = { viator: "Viator", getyourguide: "GetYourGuide" };
  if (!boats.length || !dates.length) return;

  function affiliateFor(code) {
    var b = boats.filter(function (x) { return x.code === code; })[0];
    var aff = b && b.affiliate;
    return aff && aff.url ? aff : null;
  }
  function affiliateUrl(aff) {
    var map = {
      date: state.date || "",
      time: state.time || "",
      adults: state.adults,
      children: state.children,
      guests: guests()
    };
    return Object.keys(map).reduce(function (url, key) {
      return url.replace(new RegExp("\\{" + key + "\\}", "g"), encodeURIComponent(map[key]));
    }, aff.url);
  }
  function partnerName(code) {
    var aff = affiliateFor(code);
    return aff ? (PARTNER_NAMES[aff.provider] || "our booking partner") : "";
  }

  /* --------------------------------------------------------------- containers */
  var stepBarInner = document.querySelector("div.sticky > div.scrollbar-none");
  var grid = document.querySelector("#wizard > div");
  if (!grid) return;
  var mainCol = grid.children[0];
  var aside = grid.querySelector("aside");
  var stepHost = mainCol.children[0];
  var navHost = mainCol.children[1];
  var wizardSection = document.getElementById("wizard");

  /* ------------------------------------------------------------------- state */
  var state = {
    step: 0,
    date: null,
    boatCode: null,
    time: null,
    dockCode: null,
    adults: 2,
    children: 0,
    addons: [],
    name: "",
    email: "",
    touched: false,
    pending: false,
    monthIndex: 0,
    optionIndex: null,
    bookingError: null
  };

  /* ------------------------------------------------------------------ helpers */
  var money = function (cents) {
    return new Intl.NumberFormat("en-NL", { style: "currency", currency: "EUR" }).format(cents / 100);
  };
  var dateLabel = function (iso) {
    if (!iso) return "";
    return new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", {
      weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC"
    });
  };
  var monthKey = function (iso) { return iso.slice(0, 7); };
  var monthShort = function (key) {
    return new Date(key + "-01T00:00:00Z").toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
  };
  var addMinutes = function (time, mins) {
    if (!time) return "";
    var p = time.split(":");
    var t = Number(p[0]) * 60 + Number(p[1]) + mins;
    return String(Math.floor(t / 60) % 24).padStart(2, "0") + ":" + String(t % 60).padStart(2, "0");
  };
  var pad2 = function (n) { return String(n).padStart(2, "0"); };
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  };
  var boat = function (code) {
    return boats.filter(function (b) { return b.code === (code || state.boatCode); })[0] || null;
  };
  var dock = function (code) {
    return docks.filter(function (d) { return d.code === (code || state.dockCode); })[0] || null;
  };
  var addon = function (code) {
    return addons.filter(function (a) { return a.code === code; })[0] || null;
  };
  var toneClass = function (tone) {
    return { mint: "bg-mint", magenta: "bg-magenta", amber: "bg-amber", sky: "bg-sky" }[tone] || "bg-sky";
  };
  var guests = function () { return state.adults + state.children; };

  /* Seat counts: stable for a given date/time/boat, the way a real availability API behaves. */
  function seatsFor(date, time, boatCode) {
    var b = boat(boatCode);
    if (!b) return 0;
    var s = date + "|" + time + "|" + boatCode;
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    var r = (h % 1000) / 1000;
    /* Friday and Saturday sailings are the busy ones */
    var dow = new Date(date + "T00:00:00Z").getUTCDay();
    if (dow === 5 || dow === 6) r *= 0.8;
    if (r < 0.07) return 0;            /* a few sailings sell out, most do not */
    var frac = (r - 0.07) / 0.93;
    return Math.max(1, Math.round(b.capacity * (0.08 + 0.72 * frac)));
  }
  function availability() {
    return slots.map(function (s) {
      return {
        time: s.time,
        label: s.label,
        boats: boats.map(function (b) {
          return { boatCode: b.code, capacity: b.capacity, seatsLeft: seatsFor(state.date, s.time, b.code) };
        })
      };
    });
  }
  function seatsLeftNow() {
    if (!state.date || !state.time || !state.boatCode) return null;
    return seatsFor(state.date, state.time, state.boatCode);
  }

  /* ------------------------------------------------------------------- quote */
  function quote() {
    var b = boat();
    if (!b) return null;
    var lines = [];
    if (state.adults > 0) {
      lines.push({ label: b.name + " — adult", quantity: state.adults, unit: b.adultPrice, total: b.adultPrice * state.adults });
    }
    if (state.children > 0) {
      lines.push({ label: b.name + " — child (4–12)", quantity: state.children, unit: b.childPrice, total: b.childPrice * state.children });
    }
    state.addons
      .map(addon)
      .filter(Boolean)
      .sort(function (a, c) { return a.price - c.price; })
      .forEach(function (a) {
        var qty = a.perPerson ? Math.max(1, guests()) : 1;
        lines.push({ label: a.name, quantity: qty, unit: a.price, total: a.price * qty });
      });
    var fee = 195;
    var total = lines.reduce(function (n, l) { return n + l.total; }, 0) + fee;
    return { lines: lines, bookingFee: fee, totalCents: total };
  }

  /* ------------------------------------------------------------------ icons */
  function icon(name, size, extraClass) {
    var paths = {
      "arrow-right": '<path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path>',
      "arrow-left": '<path d="m12 19-7-7 7-7"></path><path d="M19 12H5"></path>',
      check: '<path d="M20 6 9 17l-5-5"></path>',
      clock: '<circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path>',
      ship: '<path d="M12 10.189V14"></path><path d="M12 2v3"></path><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"></path><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-8.188-3.639a2 2 0 0 0-1.624 0L3 14a11.6 11.6 0 0 0 2.81 7.76"></path><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1s1.2 1 2.5 1c2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"></path>',
      "map-pin": '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"></path><circle cx="12" cy="10" r="3"></circle>',
      users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><path d="M16 3.128a4 4 0 0 1 0 7.744"></path><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><circle cx="9" cy="7" r="4"></circle>',
      minus: '<path d="M5 12h14"></path>',
      plus: '<path d="M5 12h14"></path><path d="M12 5v14"></path>',
      "circle-alert": '<circle cx="12" cy="12" r="10"></circle><line x1="12" x2="12" y1="8" y2="12"></line><line x1="12" x2="12.01" y1="16" y2="16"></line>',
      "arrow-up-right": '<path d="M7 7h10v10"></path><path d="M7 17 17 7"></path>',
      "loader-circle": '<path d="M21 12a9 9 0 1 1-6.219-8.56"></path>'
    };
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-' + name + (extraClass ? " " + extraClass : "") + '" aria-hidden="true">' + (paths[name] || "") + "</svg>";
  }

  /* --------------------------------------------------------------- step bar */
  var STEP_LABELS = ["Date", "Boat", "Time & dock", "Guests & details"];
  function stepLabels() {
    /* in partner mode step 3 is about picking the operator's cruise, not our times/docks */
    if (affiliateFor(state.boatCode)) {
      var l = STEP_LABELS.slice();
      l[2] = "Choose your cruise";
      return l;
    }
    return STEP_LABELS;
  }
  function renderStepBar() {
    if (!stepBarInner) return;
    stepBarInner.innerHTML = stepLabels().map(function (label, i) {
      var done = i < state.step;
      var current = i === state.step;
      var cls = "label-xs flex flex-1 shrink-0 items-center justify-center gap-2 whitespace-nowrap px-3 py-4 transition-colors md:gap-3 md:px-4 " +
        (current ? "bg-magenta text-paper" : done ? "text-mint hover:bg-paper/10" : "text-paper/35");
      return '<button type="button"' + (i > state.step ? " disabled" : "") + ' class="' + cls + '" data-step="' + i + '">' +
        '<span class="flex h-6 w-6 shrink-0 items-center justify-center border-2 border-current">' + (done ? icon("check", 13) : i + 1) + "</span>" +
        '<span class="' + (current ? "inline" : "hidden md:inline") + '">' + esc(label) + "</span></button>";
    }).join("");
    stepBarInner.querySelectorAll("button[data-step]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var i = Number(btn.getAttribute("data-step"));
        if (i < state.step) go(i);
      });
    });
  }

  /* --------------------------------------------------------------- step body */
  function stepHead(num, title, sub) {
    return '<div class="flex flex-wrap items-end justify-between gap-5"><div class="flex items-baseline gap-4">' +
      '<span class="font-display text-4xl leading-none text-magenta">' + num + "</span>" +
      '<h2 class="headline section-type">' + esc(title) + "</h2></div>" +
      (sub || "") + "</div>";
  }

  function monthKeys() {
    var seen = [];
    dates.forEach(function (d) {
      var k = monthKey(d);
      if (seen.indexOf(k) === -1) seen.push(k);
    });
    return seen;
  }

  function renderDate() {
    var months = monthKeys();
    if (state.monthIndex >= months.length) state.monthIndex = 0;
    var key = months[state.monthIndex];
    var year = Number(key.slice(0, 4));
    var month = Number(key.slice(5, 7));
    var firstWeekday = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7; /* Mon = 0 */
    var daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

    var tabs = months.map(function (k, i) {
      var cls = "label-xs border-2 px-4 py-2.5 transition-colors " +
        (i === state.monthIndex ? "border-mint bg-mint text-night" : "border-paper/20 text-paper/65 hover:border-paper hover:text-paper");
      return '<button type="button" class="' + cls + '" data-month="' + i + '">' + esc(monthShort(k)) + "</button>";
    }).join("");

    var cells = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(function (d) {
      return '<span class="pb-1 text-center text-[10px] font-bold uppercase tracking-[0.14em] text-paper/35">' + d + "</span>";
    }).join("");
    for (var b = 0; b < firstWeekday; b++) cells += '<span aria-hidden="true"></span>';
    for (var day = 1; day <= daysInMonth; day++) {
      var iso = key + "-" + pad2(day);
      var sailing = dates.indexOf(iso) !== -1;
      var selected = state.date === iso;
      var cls = sailing
        ? "border-2 py-3 text-center transition-colors sm:py-4 " + (selected ? "border-mint bg-mint text-night" : "border-paper/20 text-paper hover:border-paper")
        : "border-2 py-3 text-center transition-colors sm:py-4 cursor-not-allowed border-paper/8 text-paper/20";
      cells += '<button type="button"' + (sailing ? "" : " disabled") + ' class="' + cls + '"' + (sailing ? ' data-date="' + iso + '"' : "") + ">" +
        '<span class="block font-display text-xl leading-none sm:text-2xl">' + day + "</span></button>";
    }

    stepHost.innerHTML = '<div>' + stepHead("01", "Pick your night", '<div class="flex gap-2">' + tabs + "</div>") +
      '<div class="mt-8"><div class="grid grid-cols-7 gap-2 sm:gap-3">' + cells + "</div>" +
      '<p class="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-paper/55">' +
      "<span>Sailings every night of the edition except 24 and 25 December.</span>" +
      (state.date ? '<span class="text-mint">Selected: ' + esc(dateLabel(state.date)) + "</span>" : "") +
      "</p></div></div>";

    stepHost.querySelectorAll("button[data-month]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.monthIndex = Number(btn.getAttribute("data-month"));
        renderDate();
      });
    });
    stepHost.querySelectorAll("button[data-date]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.date = btn.getAttribute("data-date");
        state.time = null;
        renderAll();
      });
    });
  }

  /* --------------------------------------------------- slideable partner rails */
  var CHEV_L = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"></path></svg>';
  var CHEV_R = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg>';

  /* one rail: arrows, a hint, and the slides. Nothing moves on its own - the visitor
     slides, drags, scrolls or uses the arrow keys. */
  function railBlock(id, slides, hint) {
    return '<div class="mt-7 flex flex-wrap items-center justify-between gap-3">' +
      '<p class="text-[11px] uppercase tracking-[0.16em] text-paper/40">' + (hint || "Slide through the offers") + "</p>" +
      '<div class="flex gap-2">' +
      '<button type="button" data-rail="prev" aria-label="Slide back" class="rail-arrow">' + CHEV_L + "</button>" +
      '<button type="button" data-rail="next" aria-label="Slide forward" class="rail-arrow">' + CHEV_R + "</button>" +
      "</div></div>" +
      '<div class="offer-rail mt-4" id="' + id + '" tabindex="0" role="group" aria-label="Offers">' + slides + "</div>";
  }

  function wireRail(host, id) {
    var rail = host.querySelector("#" + id);
    if (!rail) return;
    /* instant, not smooth: a smooth scroll never runs while the tab is not rendering
       (background tab, hidden window), so the arrows would look dead */
    host.querySelectorAll("[data-rail]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var first = rail.querySelector(":scope > *");
        var step = first ? first.getBoundingClientRect().width + 16 : rail.clientWidth * 0.8;
        rail.scrollBy({ left: btn.getAttribute("data-rail") === "next" ? step : -step, behavior: "instant" });
      });
    });
    rail.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      rail.scrollBy({ left: (e.key === "ArrowRight" ? 1 : -1) * rail.clientWidth * 0.8, behavior: "instant" });
    });
  }

  function renderBoat() {
    var cards = boats.map(function (b) {
      var selected = state.boatCode === b.code;
      var aff = affiliateFor(b.code);
      var opts = aff ? (aff.options || []) : [];
      /* in partner mode the card describes the category and its real offers, not our
         invented boat/price list */
      var prices = opts.map(function (o) { return o.priceFrom; }).filter(Boolean);
      var cheapest = prices.length ? Math.min.apply(null, prices) : null;
      var durations = opts.map(function (o) { return o.durationMinutes; }).filter(Boolean);
      var title = aff ? b.kind : b.name;
      var blurb = aff
        ? (opts.length ? opts.length + " real " + (opts.length === 1 ? "cruise" : "cruises") + " in this category, with live prices and departure times" : "No offers configured yet")
        : b.description;
      var priceLine = aff
        ? (cheapest ? '<span class="font-display text-3xl text-paper">from ' + money(cheapest) + "</span>" +
            '<span class="text-xs uppercase tracking-[0.16em] text-paper/50">per person, all operators</span>'
          : '<span class="text-xs uppercase tracking-[0.16em] text-paper/50">prices on the booking page</span>')
        : '<span class="font-display text-3xl text-paper">' + money(b.adultPrice) + "</span>" +
          '<span class="text-xs uppercase tracking-[0.16em] text-paper/50">adult · ' + money(b.childPrice) + " child</span>";
      return '<button type="button" data-boat="' + b.code + '" class="offer-slide flex flex-col border-2 text-left transition-colors ' +
        (selected ? "border-mint bg-mint/10" : "border-paper/20 hover:border-paper") + '">' +
        '<div class="duotone ' + toneClass(b.tone) + ' aspect-16/9 w-full">' +
        '<img src="' + b.image.replace(/^\//, "") + '" alt="' + esc(title) + '" loading="lazy"><div class="duotone-floor"></div></div>' +
        '<div class="flex flex-1 flex-col p-5">' +
        '<span class="label-xs text-mint">' + esc(aff ? "Choose this category" : b.kind) + "</span>" +
        '<p class="headline mt-2 text-xl md:text-2xl">' + esc(title) + "</p>" +
        '<p class="mt-3 text-sm leading-relaxed text-paper/65">' + esc(blurb) + "</p>" +
        '<div class="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs uppercase tracking-[0.14em] text-paper/55">' +
        (durations.length
          ? '<span class="flex items-center gap-2">' + icon("clock", 14, "text-magenta") + " " +
            (Math.min.apply(null, durations) === Math.max.apply(null, durations)
              ? Math.min.apply(null, durations) + " min"
              : Math.min.apply(null, durations) + "–" + Math.max.apply(null, durations) + " min") + "</span>"
          : '<span class="flex items-center gap-2">' + icon("clock", 14, "text-magenta") + " " + b.durationMinutes + " min</span>") +
        (aff ? "" : '<span class="flex items-center gap-2">' + icon("users", 14, "text-magenta") + " " + b.capacity + " seats</span>") +
        (aff && opts.length ? '<span class="flex items-center gap-2">' + opts.length + (opts.length === 1 ? " cruise" : " cruises") + "</span>" : "") +
        "</div>" +
        '<div class="mt-5 flex items-baseline gap-3 border-t border-paper/15 pt-4">' + priceLine + "</div>" +
        "</div></button>";
    }).join("");

    stepHost.innerHTML = "<div>" + stepHead("02", "Choose a boat") +
      '<p class="mt-4 max-w-xl text-paper/65">Same artworks, different way of seeing them. Prices are per person.</p>' +
      railBlock("boat-rail", cards) + "</div>";

    wireRail(stepHost, "boat-rail");

    stepHost.querySelectorAll("button[data-boat]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.boatCode = btn.getAttribute("data-boat");
        state.time = null;
        renderAll();
      });
    });
  }

  function renderTime() {
    var b = boat();
    /* partner mode: this step becomes "pick which operator's cruise you want" */
    if (affiliateFor(state.boatCode)) return renderOffers(b);
    var rows = availability();
    var slotHtml = rows.map(function (row) {
      var entry = row.boats.filter(function (x) { return x.boatCode === state.boatCode; })[0];
      var seats = entry ? entry.seatsLeft : 0;
      var capacity = entry ? entry.capacity : 0;
      var soldOut = seats === 0;
      var selected = state.time === row.time;
      var cls = "border-2 p-4 text-left transition-colors " +
        (selected ? "border-mint bg-mint text-night" : soldOut ? "cursor-not-allowed border-paper/10 text-paper/30" : "border-paper/20 text-paper hover:border-paper");
      var seatCls = "mt-3 block text-xs font-bold " + (soldOut ? "text-paper/30" : selected ? "text-night" : seats <= 6 ? "text-magenta" : "text-mint");
      var seatText = soldOut
        ? "Sold out"
        : seats + " of " + capacity + " seats left · back " + addMinutes(row.time, b ? b.durationMinutes : 0);
      return '<button type="button"' + (soldOut ? " disabled" : "") + ' data-time="' + row.time + '" class="' + cls + '">' +
        '<span class="font-display text-2xl leading-none">' + row.time + "</span>" +
        '<span class="label-xs mt-2 block ' + (selected ? "text-night/70" : "text-paper/55") + '">' + esc(row.label) + "</span>" +
        '<span class="' + seatCls + '">' + esc(seatText) + "</span></button>";
    }).join("");

    var dockHtml = docks.map(function (d) {
      var selected = state.dockCode === d.code;
      return '<button type="button" data-dock="' + d.code + '" class="flex gap-4 border-2 p-4 text-left transition-colors ' +
        (selected ? "border-mint bg-mint/10" : "border-paper/20 hover:border-paper") + '">' +
        icon("map-pin", 17, "mt-1 shrink-0 text-magenta") +
        '<span><span class="headline block text-base">' + esc(d.name) + "</span>" +
        '<span class="mt-1 block text-sm text-paper/70">' + esc(d.address) + "</span>" +
        '<span class="mt-1 block text-xs text-paper/50">' + esc(d.note) + "</span></span></button>";
    }).join("");

    stepHost.innerHTML = "<div>" + stepHead("03", "Departure time & dock") +
      '<p class="mt-4 max-w-xl text-paper/65">' + esc(dateLabel(state.date)) + " — " + esc(b ? b.name : "") +
      ". Seats shown are what is left right now.</p>" +
      '<div class="mt-8 grid gap-8 xl:grid-cols-2 xl:gap-10">' +
      '<div class="grid gap-3 sm:grid-cols-2">' + slotHtml + "</div>" +
      '<div><p class="label-xs text-magenta">Departure dock</p><div class="mt-5 grid gap-3">' + dockHtml + "</div></div>" +
      "</div></div>";

    stepHost.querySelectorAll("button[data-time]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.time = btn.getAttribute("data-time");
        renderAll();
      });
    });
    stepHost.querySelectorAll("button[data-dock]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.dockCode = btn.getAttribute("data-dock");
        renderAll();
      });
    });
  }

  function renderGuests() {
    var b = boat();
    var seats = seatsLeftNow();
    var party = guests();

    function counter(kind, label, hint, value, min) {
      return '<div class="flex items-center justify-between border-2 border-paper/20 p-5">' +
        '<div><p class="headline text-lg">' + label + '</p><p class="mt-1 text-xs text-paper/55">' + hint + "</p></div>" +
        '<div class="flex items-center gap-4">' +
        '<button type="button" data-count="' + kind + '" data-delta="-1" aria-label="One fewer ' + label + '"' +
        (value <= min ? " disabled" : "") +
        ' class="flex h-10 w-10 items-center justify-center border-2 border-paper/30 text-paper transition-colors hover:border-mint hover:text-mint disabled:opacity-30">' + icon("minus", 16) + "</button>" +
        '<span class="w-8 text-center font-display text-3xl leading-none">' + value + "</span>" +
        '<button type="button" data-count="' + kind + '" data-delta="1" aria-label="One more ' + label + '"' +
        (value >= 20 ? " disabled" : "") +
        ' class="flex h-10 w-10 items-center justify-center border-2 border-paper/30 text-paper transition-colors hover:border-mint hover:text-mint disabled:opacity-30">' + icon("plus", 16) + "</button>" +
        "</div></div>";
    }

    var seatsLine = "";
    var affiliateMode = !!affiliateFor(state.boatCode);
    if (affiliateMode) {
      /* in affiliate mode the real seat count lives on the partner's page — never invent one */
      seatsLine = "";
    } else if (seats !== null) {
      var over = party > seats;
      seatsLine = '<p class="mt-4 flex items-center gap-2 text-sm ' + (over ? "text-magenta" : "text-paper/55") + '">' +
        (over ? icon("circle-alert", 15) : "") +
        (over
          ? "Only " + seats + " seats left on this sailing — reduce the party or pick another time."
          : seats + " seats left on this sailing.") +
        "</p>";
    }

    var nameError = state.touched && state.name.trim().length < 2;
    var emailError = state.touched && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email);

    var holder = '<div class="mt-8"><p class="label-xs text-magenta">Ticket holder</p><div class="mt-5 grid gap-4">' +
      '<label class="block"><span class="label-xs text-paper/55">Full name</span>' +
      '<input id="alf-name" type="text" value="' + esc(state.name) + '" placeholder="Jane de Vries" class="mt-3 w-full border-2 bg-transparent px-5 py-4 text-base text-paper placeholder:text-paper/35 focus:outline-none ' +
      (nameError ? "border-magenta" : "border-paper/25 focus:border-mint") + '">' +
      '<span class="mt-2 block text-xs text-magenta"' + (nameError ? "" : " hidden") + ' id="alf-name-error">Enter your name</span></label>' +
      '<label class="block"><span class="label-xs text-paper/55">Email</span>' +
      '<input id="alf-email" type="email" value="' + esc(state.email) + '" placeholder="jane@example.com" class="mt-3 w-full border-2 bg-transparent px-5 py-4 text-base text-paper placeholder:text-paper/35 focus:outline-none ' +
      (emailError ? "border-magenta" : "border-paper/25 focus:border-mint") + '">' +
      '<span class="mt-2 block text-xs text-magenta"' + (emailError ? "" : " hidden") + ' id="alf-email-error">Enter a valid email</span></label>' +
      "</div><p class=\"mt-4 text-xs text-paper/45\">This is a demo. Nothing is emailed and no payment is processed — your ticket appears on the next screen.</p></div>";

    var addonHtml = addons.map(function (a) {
      var checked = state.addons.indexOf(a.code) !== -1;
      return '<button type="button" data-addon="' + a.code + '" class="flex w-full items-start gap-4 border-2 p-4 text-left transition-colors ' +
        (checked ? "border-mint bg-mint/10" : "border-paper/20 hover:border-paper") + '">' +
        '<span class="mt-1 flex h-5 w-5 shrink-0 items-center justify-center border-2 ' +
        (checked ? "border-mint bg-mint text-night" : "border-paper/40") + '">' + (checked ? icon("check", 13) : "") + "</span>" +
        '<span class="flex-1"><span class="headline block text-lg">' + esc(a.name) + "</span>" +
        '<span class="mt-1 block text-sm text-paper/65">' + esc(a.description) + "</span></span>" +
        '<span class="shrink-0 text-right"><span class="font-display text-xl">' + money(a.price) + "</span>" +
        '<span class="label-xs mt-1 block text-paper/45">' + (a.perPerson ? "per person" : "per booking") + "</span></span></button>";
    }).join("");

    var errorBox = state.bookingError
      ? '<p class="mt-7 flex items-center gap-2 border-2 border-magenta p-4 text-sm text-magenta">' + icon("circle-alert", 16, "shrink-0") + " " + esc(state.bookingError) + "</p>"
      : "";

    var rightPanel = affiliateMode
      ? '<div><p class="label-xs text-magenta">What happens next</p><div class="mt-5 grid gap-3">' +
        '<p class="border-2 border-paper/20 p-5 text-sm leading-relaxed text-paper/70">Your date and boat are kept — that is the cruise you are booking.</p>' +
        '<p class="border-2 border-paper/20 p-5 text-sm leading-relaxed text-paper/70">Departure time, dock and any extras are chosen on ' + esc(partnerName(state.boatCode)) + "'s own secure page.</p>" +
        '<p class="border-2 border-paper/20 p-5 text-sm leading-relaxed text-paper/70">They take the payment and email the tickets. Nothing is charged on this site.</p>' +
        "</div></div>"
      : '<div><p class="label-xs text-magenta">Add-ons</p><div class="mt-5 grid gap-3">' + addonHtml + "</div></div>";

    stepHost.innerHTML = "<div>" + stepHead("04", "Guests & details") +
      '<div class="mt-8 grid gap-8 xl:grid-cols-2 xl:gap-10">' +
      "<div><div class=\"grid gap-4\">" +
      counter("adults", "Adults", b ? money(b.adultPrice) + " each" : "", state.adults, 0) +
      counter("children", "Children 4–12", b ? money(b.childPrice) + " each" : "Under 4 sail free", state.children, 0) +
      "</div>" + seatsLine + (affiliateMode ? "" : holder) + "</div>" +
      rightPanel +
      "</div>" + errorBox + "</div>";

    stepHost.querySelectorAll("button[data-count]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var kind = btn.getAttribute("data-count");
        var delta = Number(btn.getAttribute("data-delta"));
        var next = Math.min(20, Math.max(0, state[kind] + delta));
        state[kind] = next;
        renderAll();
      });
    });
    stepHost.querySelectorAll("button[data-addon]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var code = btn.getAttribute("data-addon");
        var i = state.addons.indexOf(code);
        if (i === -1) state.addons.push(code);
        else state.addons.splice(i, 1);
        renderAll();
      });
    });

    var nameInput = document.getElementById("alf-name");
    var emailInput = document.getElementById("alf-email");
    function refreshErrors() {
      var nErr = state.touched && state.name.trim().length < 2;
      var eErr = state.touched && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email);
      var nBox = document.getElementById("alf-name-error");
      var eBox = document.getElementById("alf-email-error");
      if (nBox) nBox.hidden = !nErr;
      if (eBox) eBox.hidden = !eErr;
      if (nameInput) nameInput.className = "mt-3 w-full border-2 bg-transparent px-5 py-4 text-base text-paper placeholder:text-paper/35 focus:outline-none " + (nErr ? "border-magenta" : "border-paper/25 focus:border-mint");
      if (emailInput) emailInput.className = "mt-3 w-full border-2 bg-transparent px-5 py-4 text-base text-paper placeholder:text-paper/35 focus:outline-none " + (eErr ? "border-magenta" : "border-paper/25 focus:border-mint");
    }
    if (nameInput) nameInput.addEventListener("input", function () { state.name = nameInput.value; refreshErrors(); });
    if (emailInput) emailInput.addEventListener("input", function () { state.email = emailInput.value; refreshErrors(); });
  }

  /* ------------------------------------------------- offers (partner mode only) */
  function departureLine(o) {
    var t = o.times || [];
    var days = o.days || [];
    var dayText = days.length >= 7 ? "Nightly" : (days.length ? days.join(", ") : "");
    if (!t.length) {
      return o.provider === "getyourguide" ? "Live times and prices appear on the booking page" : "";
    }
    if (o.timesStatus === "typical") {
      return (dayText ? dayText + " · " : "") + "typical evening departures " + t[0] + "–" + t[t.length - 1] + " — confirmed on the booking page";
    }
    if (t.length <= 8) return (dayText ? dayText + " · " : "") + "departs " + t.join(" · ");
    var gaps = [];
    for (var i = 1; i < t.length; i++) {
      var a = t[i - 1].split(":"), b = t[i].split(":");
      gaps.push((Number(b[0]) * 60 + Number(b[1])) - (Number(a[0]) * 60 + Number(a[1])));
    }
    gaps.sort(function (x, y) { return x - y; });
    var step = gaps[Math.floor(gaps.length / 2)] || 20;
    return (dayText ? dayText + " · " : "") + "departures " + t[0] + "–" + t[t.length - 1] + ", every " + step + " min";
  }

  function renderOffers(b) {
    var aff = affiliateFor(b.code);
    var opts = aff.options || [];
    var cards = opts.map(function (o, i) {
      var selected = state.optionIndex === i;
      var dep = departureLine(o);
      var partner = PARTNER_NAMES[o.provider] || o.provider || "the operator";
      var bookUrl = o.url || aff.categoryUrl || "";
      return '<div class="offer-slide flex flex-col border-2 transition-colors ' +
        (selected ? "border-mint bg-mint/10" : "border-paper/20 hover:border-paper") + '">' +
        '<button type="button" data-option="' + i + '" class="flex flex-1 items-start gap-4 p-5 text-left">' +
        '<span class="mt-1 flex h-5 w-5 shrink-0 items-center justify-center border-2 ' +
        (selected ? "border-mint bg-mint text-night" : "border-paper/40") + '">' + (selected ? icon("check", 13) : "") + "</span>" +
        '<span class="flex-1">' +
        '<span class="label-xs ' + (o.provider === "viator" ? "text-magenta" : "text-mint") + '">' + esc(partner) + "</span>" +
        '<span class="headline mt-2 block text-lg">' + esc(o.title || "") + "</span>" +
        (o.note ? '<span class="mt-1 block text-sm text-paper/65">' + esc(o.note) + "</span>" : "") +
        '<span class="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs uppercase tracking-[0.14em] text-paper/55">' +
        (o.durationMinutes ? '<span class="flex items-center gap-2">' + icon("clock", 13, "text-magenta") + " " + o.durationMinutes + " min</span>" : "") +
        (o.reviews ? "<span>" + esc(String(o.rating || "")) + " ★ · " + esc(String(o.reviews)) + " reviews</span>" : "") +
        "</span>" +
        (dep ? '<span class="mt-3 flex items-start gap-2 text-xs leading-relaxed text-mint">' + icon("clock", 13, "mt-0.5 shrink-0") + "<span>" + esc(dep) + "</span></span>" : "") +
        "</span></button>" +
        /* straight through to the partner: one click, no wizard needed */
        '<div class="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-paper/15 px-5 py-4">' +
        '<span class="font-display text-xl">' + (o.priceFrom ? "from " + money(o.priceFrom) : "price on the page") + "</span>" +
        (bookUrl
          ? '<a href="' + esc(bookUrl) + '" target="_blank" rel="noopener sponsored" class="label-xs flex items-center gap-2 border-2 border-mint px-4 py-3 text-mint transition-colors hover:bg-mint hover:text-night">Book on ' + esc(partner) + " " + icon("arrow-up-right", 12) + "</a>"
          : "") +
        "</div></div>";
    }).join("");

    var allLink = aff.categoryUrl
      ? '<a href="' + esc(aff.categoryUrl) + '" target="_blank" rel="noopener sponsored" class="btn-outline on-dark mt-6 text-paper">See everything in this category ' + icon("arrow-up-right", 14) + "</a>"
      : "";

    stepHost.innerHTML = "<div>" + stepHead("03", "Choose your cruise") +
      '<p class="mt-4 max-w-xl text-paper/65">' + esc(dateLabel(state.date)) + " — " + esc(b.kind) +
      ". These are the operators currently offering this kind of boat. Prices and times are theirs, checked on the booking page.</p>" +
      (cards
        ? railBlock("offer-rail", cards, "Slide through the offers — or book straight away")
        : '<p class="mt-8 border-2 border-paper/20 p-5 text-sm text-paper/60">No offers configured for this category yet.</p>') +
      allLink +
      '<p class="mt-6 text-xs leading-relaxed text-paper/45">Every booking is completed on the operator\'s or the platform\'s own page. We may earn a commission — it never changes the price you pay.</p>' +
      "</div>";

    if (cards) wireRail(stepHost, "offer-rail");

    stepHost.querySelectorAll("button[data-option]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.optionIndex = Number(btn.getAttribute("data-option"));
        renderAll();
      });
    });
  }

  /* ------------------------------------------------------------------- aside */
  var ICON_BY_ROW = { "Date & time": "clock", Boat: "ship", "Departure dock": "map-pin", Guests: "users" };
  function summaryRow(label, value) {
    return '<li class="flex gap-4"><span class="mt-1 shrink-0 text-magenta">' + icon(ICON_BY_ROW[label], 15) + "</span>" +
      '<span><span class="label-xs block text-paper/45">' + label + "</span>" +
      '<span class="mt-1 block text-paper">' + esc(value) + "</span></span></li>";
  }

  function renderSummary() {
    var b = boat();
    var d = dock();
    var q = quote();
    var affNow = affiliateFor(state.boatCode);
    var optNow = affNow ? (affNow.options || [])[state.optionIndex] : null;

    var dateTime = dateLabel(state.date) || "—";
    if (state.time && b) dateTime += " · " + state.time + "–" + addMinutes(state.time, b.durationMinutes);
    else if (state.time) dateTime += " · " + state.time;

    var guestText = state.adults + " adult" + (state.adults === 1 ? "" : "s");
    if (state.children > 0) guestText += ", " + state.children + " child" + (state.children === 1 ? "" : "ren");

    var boatValue = "—";
    if (b) {
      var mins = affNow ? (optNow && optNow.durationMinutes) : b.durationMinutes;
      boatValue = b.kind + (mins ? " · " + mins + " min" : "");
    }

    var rows = summaryRow("Date & time", dateTime) +
      summaryRow("Boat", boatValue) +
      /* in partner mode the dock is chosen on the partner's page, so never invent one */
      (affNow ? "" : summaryRow("Departure dock", d ? d.name : "—")) +
      summaryRow("Guests", guestText) +
      (affNow ? summaryRow("Cruise", optNow ? optNow.title : "Not chosen yet") : "");

    /* partner mode: show the real offer's price, never the demo price list */
    var pricing;
    if (affNow) {
      var prices = (affNow.options || []).map(function (o) { return o.priceFrom; }).filter(Boolean);
      var cheapest = prices.length ? Math.min.apply(null, prices) : null;
      pricing = '<div class="mt-6 space-y-3 text-sm">' +
        (optNow
          ? '<div class="flex justify-between gap-4 text-paper/75"><span>' + esc(optNow.title) + "</span>" +
            '<span class="tabular-nums">' + (optNow.priceFrom ? "from " + money(optNow.priceFrom) : "") + "</span></div>" +
            (optNow.reviews ? '<div class="text-xs text-paper/45">' + esc(String(optNow.rating || "")) + " ★ from " + esc(String(optNow.reviews)) + " reviews</div>" : "")
          : '<p class="text-paper/50">Pick one of the offers to see its price.</p>') +
        '<div class="mt-5 flex items-baseline justify-between border-t border-paper/15 pt-5">' +
        '<span class="label-xs text-paper/60">' + (optNow ? "Price from, per person" : "Cheapest in this category") + "</span>" +
        '<span class="font-display text-4xl text-mint">' +
        (optNow && optNow.priceFrom ? money(optNow.priceFrom) : (cheapest ? money(cheapest) : "—")) +
        "</span></div></div>";
    } else {
      pricing = q
        ? '<div class="mt-6 space-y-3 text-sm">' +
          q.lines.map(function (l) {
            return '<div class="flex justify-between gap-4 text-paper/75"><span>' + esc(l.label) + (l.quantity > 1 ? " × " + l.quantity : "") + "</span>" +
              '<span class="tabular-nums">' + money(l.total) + "</span></div>";
          }).join("") +
          '<div class="flex justify-between gap-4 text-paper/50"><span>Booking fee</span><span class="tabular-nums">' + money(q.bookingFee) + "</span></div>" +
          '<div class="mt-5 flex items-baseline justify-between border-t border-paper/15 pt-5">' +
          '<span class="label-xs text-paper/60">Total</span>' +
          '<span class="font-display text-4xl text-mint">' + money(q.totalCents) + "</span></div></div>"
        : '<p class="mt-6 text-sm text-paper/50">Pick a boat to see the price breakdown.</p>';
    }

    aside.innerHTML = '<div class="sticky top-40 border-2 border-paper/20 bg-[#0c1238] p-6 md:p-8">' +
      '<p class="label-xs text-mint">Your cruise</p>' +
      '<h2 class="headline mt-4 text-2xl">' + esc(b ? (affNow ? b.kind : b.name) : "Nothing selected yet") + "</h2>" +
      '<ul class="mt-7 space-y-4 border-y border-paper/15 py-6 text-sm">' + rows + "</ul>" +
      pricing +
      '<p class="mt-7 text-xs leading-relaxed text-paper/40">' +
      (affNow
        ? "Prices shown are our booking partner's current prices. We may earn a commission when you book — it never changes what you pay."
        : "Free cancellation up to 24 hours before departure. Demo site — no payment is taken.") +
      "</p></div>";
  }

  /* --------------------------------------------------------------------- nav */
  function canContinue() {
    var partner = !!affiliateFor(state.boatCode);
    return [
      !!state.date,
      !!state.boatCode,
      partner ? state.optionIndex !== null : !!(state.time && state.dockCode),
      partner ? guests() >= 1 : detailsValid()
    ][state.step];
  }
  function detailsValid() {
    return state.name.trim().length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email) && guests() >= 1;
  }

  var REF_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  function makeReference() {
    var s = "";
    for (var i = 0; i < 6; i++) s += REF_CHARS[Math.floor(Math.random() * REF_CHARS.length)];
    return "ALF-" + s;
  }

  function saveBooking(booking) {
    var all = {};
    try { all = JSON.parse(localStorage.getItem("alf-bookings") || "{}"); } catch (e) { all = {}; }
    all[booking.reference] = booking;
    try { localStorage.setItem("alf-bookings", JSON.stringify(all)); } catch (e) { /* private mode */ }
  }

  function renderNav() {
    var html = "";
    if (state.step > 0) {
      html += '<button type="button" id="alf-back" class="btn-outline on-dark text-paper">' + icon("arrow-left", 16) + " Back</button>";
    }
    if (state.step < 3) {
      html += '<button type="button" id="alf-next" class="btn-solid disabled:opacity-40"' + (canContinue() ? "" : " disabled") + ">Continue " + icon("arrow-right", 16) + "</button>";
    } else if (affiliateFor(state.boatCode)) {
      /* live funnel: hand the visitor to the chosen offer's own booking page */
      var aff = affiliateFor(state.boatCode);
      var opts = aff.options || [];
      var opt = opts[state.optionIndex] || null;
      var nameFor = opt && opt.provider ? (PARTNER_NAMES[opt.provider] || "our partner") : partnerName(state.boatCode);
      var needsChoice = opts.length > 0 && !opt;
      html += '<button type="button" id="alf-affiliate" class="btn-solid"' + (needsChoice || guests() < 1 ? " disabled" : "") + ">" +
        (needsChoice ? "Select an offer above" : "Check availability on " + esc(nameFor) + " " + icon("arrow-up-right", 16)) + "</button>";
    } else {
      var q = quote();
      var label = state.pending
        ? icon("loader-circle", 16, "animate-spin") + " Confirming…"
        : "Confirm booking" + (q ? " — " + money(q.totalCents) : "");
      html += '<button type="button" id="alf-confirm" class="btn-solid disabled:opacity-40"' + (state.pending || guests() < 1 ? " disabled" : "") + ">" + label + "</button>";
    }
    navHost.innerHTML = html;

    var back = document.getElementById("alf-back");
    var next = document.getElementById("alf-next");
    var confirm = document.getElementById("alf-confirm");
    var affiliateBtn = document.getElementById("alf-affiliate");
    if (back) back.addEventListener("click", function () { go(state.step - 1); });
    if (next) next.addEventListener("click", function () { if (canContinue()) go(state.step + 1); });
    if (confirm) confirm.addEventListener("click", submit);
    if (affiliateBtn) {
      affiliateBtn.addEventListener("click", function () {
        var aff = affiliateFor(state.boatCode);
        if (!aff) return;
        var opt = (aff.options || [])[state.optionIndex] || null;
        var url = opt && opt.url ? opt.url : (aff.fallbackUrl || aff.categoryUrl || aff.url);
        if (url) window.open(affiliateUrl({ url: url }), "_blank", "noopener");
      });
    }
  }

  function submit() {
    if (state.pending) return;
    if (!detailsValid()) {
      state.touched = true;
      state.bookingError = null;
      renderAll();
      return;
    }
    state.pending = true;
    state.bookingError = null;
    renderNav();
    setTimeout(function () {
      var b = boat();
      var reference = makeReference();
      var q = quote();
      var booking = {
        reference: reference,
        date: state.date,
        time: state.time,
        adults: state.adults,
        children: state.children,
        name: state.name.trim(),
        email: state.email.trim(),
        addonCodes: state.addons.slice(),
        boatCode: state.boatCode,
        dockCode: state.dockCode,
        totalCents: q ? q.totalCents : 0,
        createdAt: new Date().toISOString()
      };
      saveBooking(booking);
      window.location.href = "ticket.html?ref=" + encodeURIComponent(reference);
    }, 700);
  }

  /* ------------------------------------------------------------------- shell */
  function go(step) {
    state.step = Math.max(0, Math.min(3, step));
    renderAll();
    if (wizardSection) {
      var top = wizardSection.getBoundingClientRect().top + window.scrollY - 128;
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    }
  }

  function renderStep() {
    if (state.step === 0) renderDate();
    else if (state.step === 1) renderBoat();
    else if (state.step === 2) renderTime();
    else renderGuests();
  }

  function renderAll() {
    renderStepBar();
    renderStep();
    renderSummary();
    renderNav();
  }

  renderAll();
})();
