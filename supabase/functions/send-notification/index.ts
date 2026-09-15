// Edge Function : envoie un email via Resend. Le secret RESEND_API_KEY reste côté serveur
// (jamais exposé au navigateur) — c'est tout l'intérêt de passer par ici plutôt que d'appeler
// l'API Resend directement depuis index.html.
//
// Déploiement : coller ce fichier dans Supabase → Edge Functions → Create a new function
// (nom : send-notification). IMPORTANT : décocher "Enforce JWT Verification" à la création
// (ou dans les settings de la fonction ensuite) — elle ne se sert jamais du JWT de l'appelant,
// et le laisser activé peut faire échouer silencieusement les envois selon le format de clé
// anon utilisé côté client. Puis dans Settings → Secrets (ou Edge Functions → Secrets), ajouter
// RESEND_API_KEY (et optionnellement NOTIF_FROM_ADDRESS, sinon l'adresse de test Resend est
// utilisée par défaut).
//
// Appelé depuis index.html via POST ${SUPABASE_URL}/functions/v1/send-notification
// avec les mêmes headers que les appels REST habituels (apikey + Authorization Bearer anon key).

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_ADDRESS = Deno.env.get("NOTIF_FROM_ADDRESS") || "OK-LA Planning <onboarding@resend.dev>";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY non configurée (Secrets de la fonction)" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  try {
    const { to, subject, html } = await req.json();
    const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean);
    if (!recipients.length || !subject || !html) {
      return new Response(JSON.stringify({ error: "to, subject et html sont requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM_ADDRESS, to: recipients, subject, html }),
    });
    const data = await resendRes.json();
    if (!resendRes.ok) {
      return new Response(JSON.stringify({ error: data }), {
        status: resendRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: true, id: data.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
