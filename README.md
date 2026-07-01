# Qlin — Landing Page

Statische Landingpage für **Qlin**, ein Terminmanagement-System für Arztpraxen
(Echtzeit-Wartezeiten, anonyme Terminbuchung, QR-Check-in).

## Inhalt

| Datei | Zweck |
|-------|-------|
| `index.html` | Seitenstruktur (semantisches HTML) |
| `styles.css` | Design-System + Layout (Tokens aus `COLORS.md` + Logo-Navy) |
| `script.js` | Mobile-Menü, Scroll-Reveals, Wartezeit-Gauge, Demo-Formular |
| `assets/qlin-logo.png` | Logo |

## Design

- **Farben** aus dem Qlin-Farbsystem: Patient-Blau `#007AFF`, Praxis-Grün `#30d158`,
  Logo-Navy `#17406B`, Apple-inspirierte Neutraltöne. Die Blau/Grün-Dualität ist ein
  strukturelles Element (Patient vs. Praxis), keine Deko.
- **Typografie:** Fraunces (Display-Serif), Space Grotesk (Grotesk/UI), Inter Tight (Fließtext).
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

## Hinweise

- Das Demo-Formular verarbeitet aktuell nur clientseitig (kein Backend). Für echte Leads
  an ein Formular-Backend / eine Edge Function anbinden.
- Impressum- und Datenschutz-Links sind Platzhalter (`#`) und müssen auf die echten
  Rechtsseiten zeigen, bevor die Seite live geht.
