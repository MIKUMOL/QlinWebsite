/* Qlin landing — small, dependency-free interactions */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- Supabase (demo-request form) --------------------------------------
     The form posts to the `demo-request` Edge Function (JWT verification off).
     That function stores the lead in the `demo_requests` table (service role,
     insert-only RLS) AND sends a notification e-mail to the practice via
     Resend. The anon / publishable key below is meant to be public — it ships
     in the client. Until it is filled in, the form falls back to a local
     confirmation so the site keeps working. */
  var SUPABASE_URL = "https://sipuirjoyeaqrxdbepqr.supabase.co";
  var SUPABASE_ANON_KEY = "sb_publishable_KxbvIFyvLtCgd4NbrEOFpA_2_6FPnFb";
  var DEMO_FUNCTION = "demo-request";
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

  /* ---- Demo-request form ------------------------------------------------
     Validation + anti-abuse. NOTE: everything here is only a first line of
     defence — a script can bypass the browser entirely, so the real rate
     limiting lives server-side in the `demo-request` Edge Function. */

  // Robust e-mail check: rejects "quatsch" like a@b, foo@bar.c, double dots …
  var isValidEmail = function (v) {
    if (!v || v.length > 200) return false;
    if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,24}$/.test(v)) return false;
    if (v.indexOf("..") !== -1) return false;               // no consecutive dots
    var at = v.split("@");
    var local = at[0], domain = at[1];
    if (local.length > 64) return false;
    if (/^\.|\.$/.test(local)) return false;                // local part: no leading/trailing dot
    if (/^[.-]|[.-]$/.test(domain)) return false;           // domain: no leading/trailing dot or hyphen
    return true;
  };

  var COOLDOWN_MS = 45000;   // client-side: min. pause between two submits
  var MIN_FILL_MS = 1200;    // client-side: forms filled faster than this ≈ bot

  var form = document.querySelector("[data-demo-form]");
  var hint = document.querySelector("[data-form-hint]");
  var consent = document.querySelector("[data-consent]");
  if (form && hint) {
    var defaultHint = hint.textContent;
    var emailInput = form.querySelector("#email");
    var practiceInput = form.querySelector("#practice");
    var locationInput = form.querySelector("#location");
    var button = form.querySelector("button[type=submit]");
    var honeypot = form.querySelector("[data-hp]");
    var readyAt = Date.now();  // time-trap baseline

    var setState = function (msg, state) {
      hint.textContent = msg;
      if (state) hint.setAttribute("data-state", state);
      else hint.removeAttribute("data-state");
    };
    var resetHint = function () {
      if (hint.getAttribute("data-state")) setState(defaultHint, null);
    };
    var fail = function (msg, el) {
      setState(msg, "err");
      if (el) { el.setAttribute("aria-invalid", "true"); el.focus(); }
    };
    var clearInvalid = function () {
      [practiceInput, locationInput, emailInput].forEach(function (el) {
        if (el) el.removeAttribute("aria-invalid");
      });
    };
    var lastSubmit = function () {
      try { return parseInt(localStorage.getItem("qlin_demo_last") || "0", 10) || 0; }
      catch (e) { return 0; }
    };
    var succeed = function (practice) {
      setState("Danke — wir melden uns innerhalb eines Werktags bei " + practice + ".", "ok");
      try { localStorage.setItem("qlin_demo_last", String(Date.now())); } catch (e) {}
      form.reset();
      clearInvalid();
      readyAt = Date.now();
      if (consent) consent.checked = false;
    };

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      clearInvalid();

      var practice = practiceInput ? practiceInput.value.trim() : "";
      var location = locationInput ? locationInput.value.trim() : "";
      var email = emailInput ? emailInput.value.trim() : "";

      if (practice.length < 2) { return fail("Bitte den Praxisnamen angeben.", practiceInput); }
      if (location.length < 2) { return fail("Bitte den Standort angeben.", locationInput); }
      if (!isValidEmail(email)) { return fail("Bitte eine gültige E-Mail-Adresse eingeben.", emailInput); }
      if (consent && !consent.checked) {
        setState("Bitte bestätigen Sie die Datenschutzerklärung.", "err");
        consent.focus();
        return;
      }

      // client cooldown: block rapid re-submits from the same browser
      if (Date.now() - lastSubmit() < COOLDOWN_MS) {
        return fail("Bitte warten Sie einen Moment, bevor Sie erneut senden.", null);
      }

      // honeypot filled OR form submitted implausibly fast → treat as bot:
      // pretend success, store nothing, send nothing.
      if ((honeypot && honeypot.value) || (Date.now() - readyAt) < MIN_FILL_MS) {
        succeed(practice);
        return;
      }
      // not connected yet → local confirmation so the site still works
      if (!supabaseReady) { succeed(practice); return; }

      if (button) button.disabled = true;
      setState("Wird gesendet …", null);
      fetch(SUPABASE_URL + "/functions/v1/" + DEMO_FUNCTION, {
        method: "POST",
        headers: {
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": "Bearer " + SUPABASE_ANON_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          practice: practice,
          location: location,
          email: email,
          source: "landing",
          user_agent: navigator.userAgent
        })
      })
        .then(function (res) {
          if (res.status === 429) {
            throw new Error("rate-limited");
          }
          if (!res.ok) throw new Error("HTTP " + res.status);
          succeed(practice);
        })
        .catch(function (err) {
          if (err && err.message === "rate-limited") {
            setState("Zu viele Anfragen in kurzer Zeit — bitte versuchen Sie es in einigen Minuten erneut.", "err");
          } else {
            setState("Senden fehlgeschlagen — bitte später erneut versuchen oder direkt per E-Mail melden.", "err");
          }
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
