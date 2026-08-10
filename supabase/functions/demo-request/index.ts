// supabase/functions/demo-request/index.ts
//
// Nimmt eine Demo-Anfrage vom Qlin-Landingpage-Formular entgegen,
// speichert sie in der Tabelle `demo_requests` (Service-Role, umgeht RLS)
// und schickt eine Benachrichtigungs-E-Mail an die Praxis über Resend.
//
// Benötigte Secrets (Supabase → Edge Functions → Secrets):
//   RESEND_API_KEY   – API-Key aus dem Resend-Dashboard  (Pflicht)
//   NOTIFY_TO        – Empfänger der Benachrichtigung     (Standard: contact@qlin.info)
//   NOTIFY_FROM      – Absender, Domain muss in Resend verifiziert sein
//                      (Standard: "Qlin <demo@qlin.info>")
//   ALLOW_ORIGIN     – erlaubte Herkunft für CORS          (Standard: "*")
//   RATE_LIMIT_SALT  – Salt zum Hashen der IP fürs Rate-Limit (empfohlen)
// SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY werden automatisch bereitgestellt.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const NOTIFY_TO = Deno.env.get("NOTIFY_TO") ?? "contact@qlin.info";
const NOTIFY_FROM = Deno.env.get("NOTIFY_FROM") ?? "Qlin <demo@qlin.info>";
const ALLOW_ORIGIN = Deno.env.get("ALLOW_ORIGIN") ?? "*";
const RATE_LIMIT_SALT = Deno.env.get("RATE_LIMIT_SALT") ?? "qlin-demo-request";

const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": ALLOW_ORIGIN,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

// Robuste E-Mail-Prüfung (deckt sich mit der Client-Prüfung in script.js).
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,24}$/;
const isValidEmail = (v: string): boolean => {
  if (!v || v.length > 200) return false;
  if (!EMAIL_RE.test(v)) return false;
  if (v.includes("..")) return false;
  const [local, domain] = v.split("@");
  if (local.length > 64) return false;
  if (/^\.|\.$/.test(local)) return false;
  if (/^[.-]|[.-]$/.test(domain)) return false;
  return true;
};

// Client-IP → SHA-256-Hash (mit Salt). Es wird nur der Hash zur
// Missbrauchs-Vermeidung gespeichert, nie die Klar-IP (DSGVO-freundlich).
const clientIp = (req: Request): string => {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  const first = fwd.split(",")[0].trim();
  return first || req.headers.get("x-real-ip") || "";
};
const hashIp = async (ip: string): Promise<string> => {
  const data = new TextEncoder().encode(RATE_LIMIT_SALT + ":" + ip);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

// Ruft die DB-Funktion demo_rate_limit(p_ip_hash) auf. Gibt true zurück,
// wenn die Anfrage erlaubt ist, false wenn das Limit erreicht wurde. Fällt
// bei Fehlern auf "erlaubt" zurück (Verfügbarkeit vor Härte).
const rateLimitAllows = async (ipHash: string): Promise<boolean> => {
  if (!SUPABASE_URL || !SERVICE_ROLE) return true;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/demo_rate_limit`, {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_ip_hash: ipHash }),
    });
    if (!res.ok) {
      console.error("rate limit rpc failed:", res.status, await res.text());
      return true;
    }
    return (await res.json()) === true;
  } catch (e) {
    console.error("rate limit rpc error:", e);
    return true;
  }
};

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        c
      ]!),
  );

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Ungültige Anfrage." }, 400);
  }

  const email = String(payload.email ?? "").trim();
  const practice = String(payload.practice ?? "").trim().slice(0, 120);
  const location = String(payload.location ?? "").trim().slice(0, 120);
  const company = String(payload.company ?? "").trim(); // Honeypot
  const source = String(payload.source ?? "landing").slice(0, 60);
  const userAgent = String(
    payload.user_agent ?? req.headers.get("user-agent") ?? "",
  ).slice(0, 500);

  // Honeypot ausgefüllt → mit hoher Wahrscheinlichkeit ein Bot: Erfolg
  // vortäuschen, nichts speichern, nichts senden.
  if (company) return json({ ok: true });

  // Rate-Limit pro (gehashter) IP — die eigentliche Bremse gegen Skripte,
  // die das Formular im Browser umgehen. Vor jeder teuren Arbeit prüfen.
  const ip = clientIp(req);
  if (ip) {
    const allowed = await rateLimitAllows(await hashIp(ip));
    if (!allowed) {
      return json(
        { error: "Zu viele Anfragen. Bitte in einigen Minuten erneut versuchen." },
        429,
      );
    }
  }

  if (!isValidEmail(email)) {
    return json({ error: "Bitte eine gültige E-Mail-Adresse eingeben." }, 400);
  }
  if (practice.length < 2) {
    return json({ error: "Bitte den Praxisnamen angeben." }, 400);
  }
  if (location.length < 2) {
    return json({ error: "Bitte den Standort angeben." }, 400);
  }

  // 1) Lead speichern (best effort; Service-Role umgeht RLS).
  if (SUPABASE_URL && SERVICE_ROLE) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/demo_requests`, {
        method: "POST",
        headers: {
          apikey: SERVICE_ROLE,
          Authorization: `Bearer ${SERVICE_ROLE}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ email, practice, location, source, user_agent: userAgent }),
      });
      if (!res.ok) {
        console.error("DB insert failed:", res.status, await res.text());
      }
    } catch (e) {
      console.error("DB insert error:", e);
    }
  }

  // 2) Benachrichtigungs-E-Mail senden (kritischer Pfad).
  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY ist nicht gesetzt.");
    return json({ error: "E-Mail-Versand ist noch nicht konfiguriert." }, 500);
  }

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#101828">
      <h2 style="margin:0 0 12px">Neue Demo-Anfrage</h2>
      <p style="margin:0 0 6px"><strong>Praxis:</strong> ${esc(practice)}</p>
      <p style="margin:0 0 6px"><strong>Standort:</strong> ${esc(location)}</p>
      <p style="margin:0 0 6px"><strong>E-Mail:</strong>
        <a href="mailto:${esc(email)}">${esc(email)}</a></p>
      <p style="margin:0 0 6px"><strong>Quelle:</strong> ${esc(source)}</p>
      <p style="margin:0 0 6px"><strong>Zeit:</strong>
        ${new Date().toLocaleString("de-DE", { timeZone: "Europe/Berlin" })} Uhr</p>
      <p style="margin:12px 0 0;color:#667085;font-size:12px">
        <strong>User-Agent:</strong> ${esc(userAgent)}</p>
    </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: NOTIFY_FROM,
        to: [NOTIFY_TO],
        reply_to: email,
        subject: `Neue Demo-Anfrage — ${practice || email}`,
        html,
      }),
    });
    if (!res.ok) {
      console.error("Resend failed:", res.status, await res.text());
      return json({ error: "E-Mail konnte nicht gesendet werden." }, 502);
    }
  } catch (e) {
    console.error("Resend error:", e);
    return json({ error: "E-Mail konnte nicht gesendet werden." }, 502);
  }

  return json({ ok: true });
});
