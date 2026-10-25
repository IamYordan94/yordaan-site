/* Lights the six sequence markers as they come into view.
   Purely cosmetic: without JS, or with reduced motion, every node is
   already drawn lit by the stylesheet. */

(function () {
  'use strict';

  var steps = document.querySelectorAll('.step');
  if (!steps.length) { return; }

  var reduce = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function lightAll() {
    for (var i = 0; i < steps.length; i++) {
      steps[i].classList.add('is-lit');
    }
  }

  if (reduce || !('IntersectionObserver' in window)) {
    lightAll();
    return;
  }

  var io = new IntersectionObserver(function (entries) {
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].isIntersecting) {
        entries[i].target.classList.add('is-lit');
        io.unobserve(entries[i].target);
      }
    }
  }, { threshold: 0.4 });

  for (var j = 0; j < steps.length; j++) {
    io.observe(steps[j]);
  }
})();
