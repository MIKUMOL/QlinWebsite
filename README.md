# Qlin — Landing Page

Statische Landingpage für **Qlin**, ein Terminmanagement-System für Arztpraxen
(Echtzeit-Wartezeiten, anonyme Terminbuchung, QR-Check-in).

## Inhalt

| Datei | Zweck |
|-------|-------|
| `index.html` | Startseite (semantisches HTML) |
| `impressum.html` | Impressum (§ 5 DDG) — mit Fill-in-Platzhaltern |
| `datenschutz.html` | Datenschutzerklärung (DSGVO) — mit Fill-in-Platzhaltern |
| `styles.css` | Design-System + Layout (Tokens aus `COLORS.md` + Logo-Navy) |
| `script.js` | Mobile-Menü, Scroll-Reveals, Wartezeit-Gauge, Demo-Formular |
| `assets/qlin-logo.png` | Logo |
| `assets/fonts/` | Selbst gehostete Schriftarten (`fonts.css` + `.woff2`) |

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

## Deployment

Als statische Seite überall hostbar (Vercel, Netlify, GitHub Pages).
Für Vercel genügt „Import“ ohne Framework-Preset (Output = Projektwurzel).

## Rechtliches / vor dem Livegang

- **Impressum & Datenschutz** liegen als eigene Seiten vor und sind im Footer verlinkt.
  Alle offenen Angaben sind im Text **farbig als `[Platzhalter]` markiert** (Name, Anschrift,
  Kontakt, Hosting-Anbieter, zuständige Aufsichtsbehörde …) — vor dem Livegang ausfüllen und
  die Markierung entfernen. Aufgebaut für: Einzelunternehmen, reines Softwareunternehmen,
  USt-IdNr. noch offen. Keine Rechtsberatung — für ein medizinnahes Produkt anwaltlich prüfen lassen.
- **Demo-Formular** verarbeitet aktuell nur clientseitig (kein Backend) und erfordert eine
  Datenschutz-Einwilligung (Checkbox). Für echte Leads an ein Formular-Backend / eine Edge
  Function anbinden und den Empfänger in der Datenschutzerklärung konkret benennen.
- **Keine Cookies / kein Tracking** → bewusst kein Cookie-Banner. Wird später Analytics ergänzt,
  ist ein Consent-Banner (§ 25 TDDDG) nötig.
