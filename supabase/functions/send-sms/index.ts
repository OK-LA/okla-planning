// Edge Function : envoie un SMS via l'API HTTP Capitole Mobile
// (https://www.capitolemobile.com/api/api-http#envoi_sms_pro). Les identifiants restent côté
// serveur (jamais exposés au navigateur) — c'est tout l'intérêt de passer par ici plutôt que
// d'appeler l'API Capitole directement depuis index.html.
//
// Déploiement : coller ce fichier dans Supabase → Edge Functions → Create a new function
// (nom : send-sms), via "Via Editor". IMPORTANT : décocher "Enforce JWT Verification" (la
// fonction ne se sert jamais du JWT de l'appelant). Puis dans les Secrets de la fonction,
// ajouter CAPITOLE_USERNAME et CAPITOLE_PASSWORD (Mon compte Capitole Mobile → SMS → Mon API).
// CAPITOLE_SENDER est optionnel (nom d'expéditeur affiché, 11 caractères max — sinon un code
// court par défaut est utilisé).
//
// Appelé depuis index.html via POST ${SUPABASE_URL}/functions/v1/send-sms avec les mêmes
// headers que les appels REST habituels (apikey + Authorization Bearer anon key).

const CAPITOLE_USERNAME = Deno.env.get("CAPITOLE_USERNAME");
const CAPITOLE_PASSWORD = Deno.env.get("CAPITOLE_PASSWORD");
const CAPITOLE_SENDER = Deno.env.get("CAPITOLE_SENDER") || "OK-LA";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (!CAPITOLE_USERNAME || !CAPITOLE_PASSWORD) {
    return new Response(JSON.stringify({ error: "CAPITOLE_USERNAME/CAPITOLE_PASSWORD non configurés (Secrets de la fonction)" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  try {
    const { to, text } = await req.json();
    const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean);
    if (!recipients.length || !text) {
      return new Response(JSON.stringify({ error: "to et text sont requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const gsmTags = recipients.map((n: string) => `<gsm>${escapeXml(n)}</gsm>`).join("");
    const xml =
      `<SMS><authentification><username>${escapeXml(CAPITOLE_USERNAME)}</username>` +
      `<password>${escapeXml(CAPITOLE_PASSWORD)}</password></authentification>` +
      `<message><text>${escapeXml(text)}</text><sender>${escapeXml(CAPITOLE_SENDER)}</sender></message>` +
      `<recipients>${gsmTags}</recipients></SMS>`;
    const capitoleRes = await fetch("https://sms.capitolemobile.com/api/sendsms/xml_v2", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "XML=" + encodeURIComponent(xml),
    });
    const resultText = (await capitoleRes.text()).trim();
    const ok = resultText.startsWith("SENDING_OK");
    return new Response(JSON.stringify({ ok, raw: resultText }), {
      status: ok ? 200 : 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
