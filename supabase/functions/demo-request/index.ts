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
// SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY werden automatisch bereitgestellt.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const NOTIFY_TO = Deno.env.get("NOTIFY_TO") ?? "contact@qlin.info";
const NOTIFY_FROM = Deno.env.get("NOTIFY_FROM") ?? "Qlin <demo@qlin.info>";
const ALLOW_ORIGIN = Deno.env.get("ALLOW_ORIGIN") ?? "*";

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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const company = String(payload.company ?? "").trim(); // Honeypot
  const source = String(payload.source ?? "landing").slice(0, 60);
  const userAgent = String(
    payload.user_agent ?? req.headers.get("user-agent") ?? "",
  ).slice(0, 500);

  // Honeypot ausgefüllt → mit hoher Wahrscheinlichkeit ein Bot: Erfolg
  // vortäuschen, nichts speichern, nichts senden.
  if (company) return json({ ok: true });

  if (!EMAIL_RE.test(email) || email.length > 200) {
    return json({ error: "Bitte eine gültige E-Mail-Adresse eingeben." }, 400);
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
        body: JSON.stringify({ email, source, user_agent: userAgent }),
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
        subject: `Neue Demo-Anfrage — ${email}`,
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
