// Prüft die statischen Seiten vor dem Deploy.
// Fängt genau die Fehlerklassen ab, die hier real aufgetreten sind:
// kaputtes JSON-LD, auseinandergelaufene FAQ-Texte, tote interne Links,
// fehlende Meta-Angaben und die zurückgekehrte "anonym"-Behauptung.
//
// Aufruf:  node tools/check-pages.mjs
// Exit 1, sobald ein Fehler gefunden wird.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const pages = readdirSync(ROOT).filter((f) => f.endsWith(".html")).sort();

const errors = [];
const warnings = [];
const err = (file, msg) => errors.push(`${file}: ${msg}`);
const warn = (file, msg) => warnings.push(`${file}: ${msg}`);

// Seiten ohne Canonical (bewusst nicht indexiert)
const NO_CANONICAL = new Set(["404.html"]);
// Seiten, auf denen "anonym" eine falsche Produktaussage wäre
const NO_ANONYM = new Set(["index.html", "funktionen.html", "ueber-qlin.html"]);

const attr = (html, re) => (html.match(re) || [])[1] || "";

for (const file of pages) {
  const html = readFileSync(join(ROOT, file), "utf8");

  // --- Kopfangaben ---
  const title = attr(html, /<title>([^<]*)<\/title>/);
  const desc = attr(html, /name="description" content="([^"]*)"/);
  const canonical = attr(html, /rel="canonical" href="([^"]*)"/);

  if (!title) err(file, "kein <title>");
  if (!desc) err(file, "keine Meta-Description");
  else if (desc.length > 160) warn(file, `Meta-Description ${desc.length} Zeichen (wird ab ca. 160 gekürzt)`);
  if (!canonical && !NO_CANONICAL.has(file)) err(file, "kein rel=canonical");
  if (!/<html lang="de"/.test(html)) err(file, 'kein lang="de"');

  // --- Genau eine H1 ---
  const h1 = (html.match(/<h1[\s>]/g) || []).length;
  if (h1 !== 1) err(file, `${h1} H1-Elemente (erwartet: genau 1)`);

  // --- Bilder ---
  for (const tag of html.match(/<img\b[^>]*>/g) || []) {
    if (!/\balt=/.test(tag)) err(file, `<img> ohne alt: ${tag.slice(0, 70)}`);
    if (!/width=/.test(tag) || !/height=/.test(tag))
      warn(file, `<img> ohne width/height (Layout-Sprung möglich): ${tag.slice(0, 70)}`);
  }

  // --- JSON-LD ---
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  if (!blocks.length && !NO_CANONICAL.has(file)) warn(file, "kein JSON-LD");
  blocks.forEach((m, i) => {
    try {
      JSON.parse(m[1]);
    } catch (e) {
      err(file, `JSON-LD Block ${i + 1} ist ungültig: ${e.message}`);
    }
  });

  // --- Produktaussage: die Buchung ist nicht anonym (Name wird erhoben) ---
  if (NO_ANONYM.has(file)) {
    const hits = (html.match(/anonym(?!isier)/gi) || []).length;
    if (hits) err(file, `${hits}x "anonym" — die Buchung erhebt den Namen, korrekt ist "ohne Konto"`);
  }

  // --- Interne Links ---
  for (const href of [...html.matchAll(/href="([^"#][^"]*)"/g)].map((m) => m[1])) {
    if (/^(https?:|mailto:|tel:)/.test(href)) continue;
    const path = href.split("#")[0].replace(/^\//, "");
    if (!path) continue;
    const candidates = [path, `${path}.html`];
    if (!candidates.some((c) => existsSync(join(ROOT, c))))
      err(file, `toter interner Link: ${href}`);
  }
}

// --- FAQ: Schema und sichtbarer Text müssen zeichengleich sein ---
{
  const html = readFileSync(join(ROOT, "index.html"), "utf8");
  const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  const faq = (ld["@graph"] || []).find((n) => n["@type"] === "FAQPage");
  const visible = [
    ...html.matchAll(/<details class="faq-item">\s*<summary><h3>([\s\S]*?)<\/h3><\/summary>\s*<p>([\s\S]*?)<\/p>/g),
  ].map((m) => ({ q: m[1].trim(), a: m[2].trim() }));

  if (!faq) err("index.html", "kein FAQPage-Schema gefunden");
  else if (faq.mainEntity.length !== visible.length)
    err("index.html", `FAQ: ${faq.mainEntity.length} Fragen im Schema, ${visible.length} im HTML`);
  else
    faq.mainEntity.forEach((q, i) => {
      if (q.name !== visible[i].q)
        err("index.html", `FAQ-Frage ${i + 1} weicht zwischen Schema und HTML ab`);
      if (q.acceptedAnswer.text !== visible[i].a)
        err("index.html", `FAQ-Antwort ${i + 1} weicht zwischen Schema und HTML ab ("${q.name}")`);
    });
}

// --- Sitemap: jede indexierbare Seite muss drin stehen ---
{
  const sitemap = readFileSync(join(ROOT, "sitemap.xml"), "utf8");
  for (const file of pages) {
    if (NO_CANONICAL.has(file)) continue;
    const slug = file === "index.html" ? "" : file.replace(/\.html$/, "");
    if (!sitemap.includes(`https://qlin.info/${slug}<`))
      err("sitemap.xml", `${file} fehlt (erwartet: https://qlin.info/${slug})`);
  }
}

for (const w of warnings) console.log(`WARN  ${w}`);
for (const e of errors) console.log(`FEHLER ${e}`);

console.log(
  `\n${pages.length} Seiten geprüft — ${errors.length} Fehler, ${warnings.length} Warnungen.`
);
process.exit(errors.length ? 1 : 0);
