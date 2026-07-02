/* Qlin landing — small, dependency-free interactions */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- Supabase (demo-request form) --------------------------------------
     The anon / publishable key is meant to be public — it ships in the client.
     Security comes from Row Level Security: this table allows INSERT only,
     never SELECT, so nobody can read the leads with this key.
     Until SUPABASE_ANON_KEY is filled in, the form falls back to a local
     confirmation so the site keeps working. */
  var SUPABASE_URL = "https://sipuirjoyeaqrxdbepqr.supabase.co";
  var SUPABASE_ANON_KEY = "sb_publishable_KxbvIFyvLtCgd4NbrEOFpA_2_6FPnFb";
  var SUPABASE_TABLE = "demo_requests";
  var supabaseReady =
    /^https:\/\//.test(SUPABASE_URL) &&
    SUPABASE_ANON_KEY.indexOf("__") === -1 &&
    SUPABASE_ANON_KEY.length > 20;

  /* ---- Footer year ---- */
  var yearEl = document.querySelector("[data-year]");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ---- Phone mock: live clock (call time = now + 12 min, matching "≈ 12 Min") ---- */
  var appTime = document.querySelector("[data-app-time]");
  var appCall = document.querySelector("[data-app-call]");
  if (appTime) {
    var pad2 = function (n) { return (n < 10 ? "0" : "") + n; };
    var fmtTime = function (d) { return pad2(d.getHours()) + ":" + pad2(d.getMinutes()); };
    var tickClock = function () {
      var now = new Date();
      appTime.textContent = fmtTime(now);
      if (appCall) appCall.textContent = fmtTime(new Date(now.getTime() + 12 * 60000));
    };
    tickClock();
    setInterval(tickClock, 15000);
  }

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

  /* ---- Demo-request form ---- */
  var form = document.querySelector("[data-demo-form]");
  var hint = document.querySelector("[data-form-hint]");
  var consent = document.querySelector("[data-consent]");
  if (form && hint) {
    var defaultHint = hint.textContent;
    var input = form.querySelector("input[type=email]");
    var button = form.querySelector("button[type=submit]");
    var honeypot = form.querySelector("[data-hp]");

    var setState = function (msg, state) {
      hint.textContent = msg;
      if (state) hint.setAttribute("data-state", state);
      else hint.removeAttribute("data-state");
    };
    var resetHint = function () {
      if (hint.getAttribute("data-state")) setState(defaultHint, null);
    };
    var succeed = function (value) {
      setState("Danke — wir melden uns innerhalb eines Werktags bei " + value + ".", "ok");
      form.reset();
      if (consent) consent.checked = false;
    };

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var value = input ? input.value.trim() : "";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        setState("Bitte eine gültige E-Mail-Adresse eingeben.", "err");
        if (input) input.focus();
        return;
      }
      if (consent && !consent.checked) {
        setState("Bitte bestätigen Sie die Datenschutzerklärung.", "err");
        consent.focus();
        return;
      }
      // honeypot filled → almost certainly a bot: pretend success, store nothing
      if (honeypot && honeypot.value) { succeed(value); return; }
      // not connected yet → local confirmation so the site still works
      if (!supabaseReady) { succeed(value); return; }

      if (button) button.disabled = true;
      setState("Wird gesendet …", null);
      fetch(SUPABASE_URL + "/rest/v1/" + SUPABASE_TABLE, {
        method: "POST",
        headers: {
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": "Bearer " + SUPABASE_ANON_KEY,
          "Content-Type": "application/json",
          "Prefer": "return=minimal"
        },
        body: JSON.stringify({
          email: value,
          source: "landing",
          user_agent: navigator.userAgent
        })
      })
        .then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          succeed(value);
        })
        .catch(function (err) {
          setState("Senden fehlgeschlagen — bitte später erneut versuchen oder direkt per E-Mail melden.", "err");
          if (window.console) console.error("Demo request failed:", err);
        })
        .finally(function () {
          if (button) button.disabled = false;
        });
    });
    form.addEventListener("input", resetHint);
    if (consent) consent.addEventListener("change", resetHint);
  }
})();
