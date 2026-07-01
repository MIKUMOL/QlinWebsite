/* Qlin landing — small, dependency-free interactions */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- Footer year ---- */
  var yearEl = document.querySelector("[data-year]");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ---- Header scrolled state ---- */
  var header = document.querySelector("[data-header]");
  function onScroll() {
    if (!header) return;
    if (window.scrollY > 8) header.setAttribute("data-scrolled", "");
    else header.removeAttribute("data-scrolled");
  }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ---- Mobile menu ---- */
  var toggle = document.querySelector("[data-menu-toggle]");
  var menu = document.querySelector("[data-mobile-menu]");
  function closeMenu() {
    if (!toggle || !menu) return;
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Menü öffnen");
    menu.hidden = true;
  }
  if (toggle && menu) {
    toggle.addEventListener("click", function () {
      var open = toggle.getAttribute("aria-expanded") === "true";
      if (open) {
        closeMenu();
      } else {
        toggle.setAttribute("aria-expanded", "true");
        toggle.setAttribute("aria-label", "Menü schließen");
        menu.hidden = false;
      }
    });
    menu.addEventListener("click", function (e) {
      if (e.target.tagName === "A") closeMenu();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeMenu();
    });
    window.addEventListener("resize", function () {
      if (window.innerWidth >= 900) closeMenu();
    });
  }

  /* ---- Reveal on scroll (with light stagger) + gauge ---- */
  var reveals = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
  var gauge = document.querySelector(".gauge");

  if (reduceMotion || !("IntersectionObserver" in window)) {
    reveals.forEach(function (el) { el.classList.add("in"); });
    if (gauge) gauge.classList.add("in");
  } else {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var el = entry.target;
          // stagger among reveal siblings sharing a parent
          var parent = el.parentElement;
          var group = parent ? parent.querySelectorAll(":scope > .reveal") : [el];
          var idx = Array.prototype.indexOf.call(group, el);
          el.style.transitionDelay = Math.min(idx * 80, 320) + "ms";
          el.classList.add("in");
          io.unobserve(el);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    reveals.forEach(function (el) { io.observe(el); });

    if (gauge) {
      var gio = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              gauge.classList.add("in");
              gio.unobserve(gauge);
            }
          });
        },
        { threshold: 0.4 }
      );
      gio.observe(gauge);
    }
  }

  /* ---- Demo form (client-side only) ---- */
  var form = document.querySelector("[data-demo-form]");
  var hint = document.querySelector("[data-form-hint]");
  var consent = document.querySelector("[data-consent]");
  if (form && hint) {
    var defaultHint = hint.textContent;
    var resetHint = function () {
      if (hint.getAttribute("data-state")) {
        hint.removeAttribute("data-state");
        hint.textContent = defaultHint;
      }
    };
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var input = form.querySelector("input[type=email]");
      var value = input ? input.value.trim() : "";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        hint.textContent = "Bitte eine gültige E-Mail-Adresse eingeben.";
        hint.setAttribute("data-state", "err");
        if (input) input.focus();
        return;
      }
      if (consent && !consent.checked) {
        hint.textContent = "Bitte bestätigen Sie die Datenschutzerklärung.";
        hint.setAttribute("data-state", "err");
        consent.focus();
        return;
      }
      hint.textContent = "Danke — wir melden uns innerhalb eines Werktags bei " + value + ".";
      hint.setAttribute("data-state", "ok");
      form.reset();
      if (consent) consent.checked = false;
    });
    form.addEventListener("input", resetHint);
    if (consent) consent.addEventListener("change", resetHint);
  }
})();
