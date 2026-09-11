# Qlin — Website

Statische Website für **Qlin**, eine Web-Software für Arztpraxen im DACH-Raum:
Terminbuchung ohne Patientenkonto, Echtzeit-Wartezeit und QR-Check-in.
Live unter **https://qlin.info**.

## Inhalt

| Datei | Zweck |
|-------|-------|
| `index.html` | Startseite inkl. FAQ (sichtbar und als `FAQPage`-Schema) |
| `funktionen.html` | Funktionsliste, Systemvoraussetzungen, Abgrenzung |
| `wartezeit-reduzieren.html` | Leitfaden „Wartezeit in der Arztpraxis reduzieren“ |
| `ueber-qlin.html` | Kurzprofil zum Zitieren, Fakten, Prinzipien, Presse |
| `impressum.html` | Impressum (§ 5 DDG) |
| `datenschutz.html` | Datenschutzerklärung (DSGVO) |
| `404.html` | Not-Found-Seite (`noindex`) |
| `styles.css` | Design-System und Layout (Tokens aus `COLORS.md` plus Logo-Navy) |
| `script.js` | Mobile-Menü, Scroll-Reveals, interaktive Demos, Demo-Formular |
| `robots.txt` | Crawler-Freigaben inkl. KI-Crawler und `Content-Signal` |
| `sitemap.xml` | alle indexierbaren Seiten |
| `llms.txt`, `llms-full.txt` | Inhalte für Sprachmodelle (Kurzfassung und Volltext) |
| `_headers` | Security-Header (CSP, HSTS …) und Cache-Regeln |
| `assets/` | Logo, Social-Preview (`og-image.png`), selbst gehostete Schriften |
| `supabase/` | Edge Function `demo-request` und SQL-Migrationen (Leads, Rate-Limit) |
| `tools/check-pages.mjs` | Prüfskript für alle Seiten, siehe unten |
| `.github/workflows/` | CI: führt das Prüfskript bei jedem Push und Pull Request aus |

## Vor jedem Commit

```bash
node tools/check-pages.mjs
```

Das Skript prüft JSON-LD, den Gleichlauf von FAQ-Schema und sichtbarem Text, genau eine
H1 pro Seite, Title, Description, Canonical und `lang`, alt-Attribute, tote interne Links
und die Sitemap — und dass „anonym“ nicht in die Produktseiten zurückkehrt. Die Buchung
erhebt den Namen des Patienten; korrekt ist „ohne Konto“.

**FAQ ändern:** Jede Antwort steht zweimal in `index.html` — im JSON-LD und im sichtbaren
`<details>`-Block. Immer beide Stellen anpassen; das Prüfskript meldet jede Abweichung.

## Design

- **Farben** aus dem Qlin-Farbsystem: Patient-Blau `#007AFF`, Praxis-Grün `#30d158`,
  Logo-Navy `#17406B`, Apple-inspirierte Neutraltöne. Die Blau/Grün-Dualität ist ein
  strukturelles Element (Patient gegenüber Praxis), keine Deko.
- **Grün als Text:** `--green-text: #0f7032` für Grün als Text oder Icon auf hellem Grund
  (WCAG AA). `--green-dark` aus `COLORS.md` nur für Flächen und Ränder — als Textfarbe
  erreicht es nur 2,8 : 1.
- **Typografie:** Fraunces (Display-Serif), Space Grotesk (Grotesk/UI), Inter Tight
  (Fließtext) — **lokal selbst gehostet** (SIL OFL), keine Verbindung zu Google Fonts
  (DSGVO / LG München I 2022).
- **Signature:** das echte „Live-Wartezeit“-Panel der App, in CSS nachgebaut.
- Mobile-first, responsiv ab 375 px, `prefers-reduced-motion` respektiert, sichtbare
  Fokus-States.

## Lokal ansehen

Kein Build nötig — statisches HTML, CSS und JS. Einen Static-Server starten:

```bash
python -m http.server 5173
```

Dann `http://localhost:5173` öffnen. Das Demo-Formular funktioniert lokal nur, wenn das
Supabase-Secret `ALLOW_ORIGIN` vorübergehend auf die lokale Adresse gesetzt ist.

## Deployment

Die Seite läuft als **Cloudflare Worker mit Static Assets** und deployt automatisch bei
jedem Push auf `main`. Es gibt keinen Build-Schritt; ausgeliefert wird das
Repository-Wurzelverzeichnis.

- **Build-Status** steht an jedem Commit in den GitHub-Checks unter
  „Workers Builds: qlinwebsite“. Nach einem Push dort nachsehen, nicht nur auf der Live-Seite.
- **`_headers`** wird unterstützt. **Keine `_redirects` mit Status 404 anlegen:** erlaubt sind
  nur 200 sowie 301, 302, 303, 307 und 308. Eine ungültige Regel lässt jeden Build scheitern.
- **404:** Unbekannte Pfade liefern derzeit einen leeren 404, weil die Not-Found-Behandlung
  des Workers auf `none` steht. Damit die eigene `404.html` greift, muss sie auf `404-page`
  stehen.
- **Alles im Repository ist öffentlich abrufbar**, auch `README.md`, `tools/`, `supabase/` und
  `.github/`. `robots.txt` sperrt diese Pfade für Crawler, aufrufbar bleiben sie trotzdem.
  Keine Secrets in diese Dateien schreiben; sie gehören in die Supabase-Secrets.
- Die **Edge Function `demo-request`** erlaubt als CORS-Origin standardmäßig
  `https://qlin.info`.
- **HSTS** in `_headers` ist aktiv (max-age ein Jahr).
- Die frühere **Vercel-Anbindung** ist abgelöst. Sie meldet an jedem Commit „Deployment was
  blocked“ und kann im Vercel-Dashboard getrennt werden.

## Rechtliches

- **Impressum und Datenschutz** sind ausgefüllt (Einzelunternehmen, Anschrift c/o POSTFLEX,
  Greven; Hosting Cloudflare, Auftragsverarbeiter Supabase [EU/Frankfurt] und Resend,
  Aufsichtsbehörde LDI NRW). USt-IdNr. ergänzen, sobald vorhanden. Keine Rechtsberatung —
  für ein medizinnahes Produkt anwaltlich prüfen lassen.
- Das **Demo-Formular** sendet an die Supabase Edge Function `demo-request` (Validierung,
  Honeypot, serverseitiges Rate-Limit über gehashte IPs) und erfordert eine
  Datenschutz-Einwilligung. Leads landen in `demo_requests` (RLS ohne Policies: nur
  Service-Role), die Benachrichtigung geht über Resend.
- **Keine Cookies, kein Tracking** auf der Website, deshalb kein Cookie-Banner. Der
  localStorage-Eintrag des Formulars (Doppelsende-Schutz) ist in der Datenschutzerklärung
  erläutert (§ 25 Abs. 2 Nr. 2 TDDDG). Kommt später Analytics dazu, sind Consent-Banner und
  eine angepasste Datenschutzerklärung nötig.
