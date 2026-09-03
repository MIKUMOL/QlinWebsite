# Qlin — Landing Page

Statische Landingpage für **Qlin**, ein Terminmanagement-System für Arztpraxen
(Echtzeit-Wartezeiten, anonyme Terminbuchung, QR-Check-in).

## Inhalt

| Datei | Zweck |
|-------|-------|
| `index.html` | Startseite (semantisches HTML) |
| `impressum.html` | Impressum (§ 5 DDG) |
| `datenschutz.html` | Datenschutzerklärung (DSGVO) |
| `styles.css` | Design-System + Layout (Tokens aus `COLORS.md` + Logo-Navy) |
| `script.js` | Mobile-Menü, Scroll-Reveals, Wartezeit-Gauge, Demo-Formular |
| `_headers` | Security-Header (CSP, HSTS …) + Cache-Regeln für Cloudflare Pages |
| `robots.txt`, `sitemap.xml` | SEO-Basics |
| `assets/qlin-logo.png` | Logo (128 px, Header/Footer/Favicon) |
| `assets/og-image.png` | Social-Media-Vorschaubild (1200×630, og:image) |
| `assets/fonts/` | Selbst gehostete Schriftarten (`fonts.css` + `.woff2`) |
| `supabase/` | Edge Function `demo-request` + SQL-Migrationen (Leads, Rate-Limit) |

## Design

- **Farben** aus dem Qlin-Farbsystem: Patient-Blau `#007AFF`, Praxis-Grün `#30d158`,
  Logo-Navy `#17406B`, Apple-inspirierte Neutraltöne. Die Blau/Grün-Dualität ist ein
  strukturelles Element (Patient vs. Praxis), keine Deko.
- **Typografie:** Fraunces (Display-Serif), Space Grotesk (Grotesk/UI), Inter Tight (Fließtext) —
  **lokal selbst gehostet** (SIL OFL), keine Verbindung zu Google Fonts (DSGVO / LG München I 2022).
- **Signature:** Das echte „Live-Wartezeit“-Panel der App, in CSS nachgebaut.
- Mobile-first, responsiv ab 375 px, `prefers-reduced-motion` respektiert, sichtbare Fokus-States.

## Lokal ansehen

Kein Build nötig — es ist statisches HTML/CSS/JS. Einfach einen Static-Server starten:

```bash
# Python
python -m http.server 5173

# oder Node
npx serve .
```

Dann `http://localhost:5173` öffnen.

## Deployment (Cloudflare Pages)

Statische Seite, **kein Build-Step**. In Cloudflare Pages:

- **Framework preset:** None
- **Build command:** *(leer lassen)*
- **Build output directory:** `/` (Projektwurzel — bzw. `qlin-website`, falls das
  Repo-Root eine Ebene höher liegt)

Enthaltene Cloudflare-Konfig:

- `_headers` — Security-Header (X-Frame-Options, HSTS, Permissions-Policy …) + Cache-Regeln.
- Clean-URLs (`/impressum` statt `/impressum.html`) macht Pages automatisch.

**Nach dem Livegang prüfen:**

- Custom Domain in Pages hinterlegen (Apex **und** `www`); für die kanonische Variante
  eine Redirect-Rule `www → Apex` (oder umgekehrt) anlegen.
- Die Edge Function `demo-request` erlaubt als CORS-Origin standardmäßig
  `https://qlin.info`. Für Tests auf einer anderen Domain (z. B. `*.pages.dev`-Preview)
  das Supabase-Secret `ALLOW_ORIGIN` entsprechend setzen.
- HSTS in `_headers` ist aktiv (max-age 1 Jahr) — erst so lassen, wenn die Seite dauerhaft
  nur noch per HTTPS läuft.

## Rechtliches

- **Impressum & Datenschutz** sind ausgefüllt (Einzelunternehmen, Hosting: Cloudflare Pages,
  Auftragsverarbeiter Supabase [EU/Frankfurt] und Resend benannt, Aufsichtsbehörde: LDA
  Brandenburg). USt-IdNr. ergänzen, sobald vorhanden. Keine Rechtsberatung — für ein
  medizinnahes Produkt anwaltlich prüfen lassen.
- **Demo-Formular** sendet an die Supabase Edge Function `demo-request` (Validierung,
  Honeypot, serverseitiges Rate-Limit über gehashte IPs) und erfordert eine
  Datenschutz-Einwilligung (Checkbox). Leads landen in `demo_requests` (RLS ohne Policies:
  nur Service-Role), Benachrichtigung per Resend.
- **Keine Cookies / kein Tracking** → bewusst kein Cookie-Banner. Der localStorage-Eintrag
  des Formulars (Doppelsende-Schutz) ist in der Datenschutzerklärung erläutert
  (§ 25 Abs. 2 Nr. 2 TDDDG). Wird später Analytics ergänzt, ist ein Consent-Banner nötig.
