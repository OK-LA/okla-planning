// Edge Function : vérifie un code d'accès employé côté serveur et signe un JWT ("authenticated")
// pour cet employé — remplace la comparaison purement client-side de doLogin()/validerPwd() dans
// index.html. C'est la première vérification d'identité réellement faite côté serveur du projet.
//
// Déploiement : Supabase → Edge Functions → Create a new function (nom : login), coller ce
// fichier. IMPORTANT : décocher "Enforce JWT Verification" — c'est le point d'entrée AVANT
// authentification, impossible d'exiger un JWT préalable ici (même raison que send-notification/
// send-sms, voir leurs commentaires).
// Secrets à ajouter (Edge Functions → Secrets) :
//   - JWT_SECRET : Settings → API → JWT Settings → "JWT Secret" du projet.
//   - SERVICE_KEY : Settings → API Keys → section "Secret keys" → la clé sb_secret_...
//     (jamais envoyée au navigateur — reste strictement dans cette fonction).
//
// Appelé depuis index.html via POST ${SUPABASE_URL}/functions/v1/login avec {code}.

const JWT_SECRET = Deno.env.get("JWT_SECRET");
const SERVICE_KEY = Deno.env.get("SERVICE_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL"); // fourni automatiquement par la plateforme

const SESSION_TTL_SECONDS = 8 * 3600; // identique au TTL client actuel (8h, voir restoreSession)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

function b64url(bytes: Uint8Array): string {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function signHS256(payload: Record<string, unknown>): Promise<string> {
  const enc = new TextEncoder();
  const header = b64url(enc.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey("raw", enc.encode(JWT_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(`${header}.${body}`)));
  return `${header}.${body}.${b64url(sig)}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!JWT_SECRET || !SERVICE_KEY || !SUPABASE_URL) {
    return new Response(JSON.stringify({ error: "login mal configuré (secrets manquants)" }), { status: 500, headers: jsonHeaders });
  }
  try {
    const { code } = await req.json();
    if (!code || typeof code !== "string") {
      return new Response(JSON.stringify({ error: "code requis" }), { status: 400, headers: jsonHeaders });
    }
    const normalized = code.trim().toUpperCase();
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/employees?code=eq.${encodeURIComponent(normalized)}&active=eq.true&select=id,auth_uid,is_manager&limit=1`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
    );
    if (!r.ok) return new Response(JSON.stringify({ error: "Erreur base de données" }), { status: 502, headers: jsonHeaders });
    const rows = await r.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return new Response(JSON.stringify({ error: "Code non reconnu" }), { status: 401, headers: jsonHeaders });
    }
    const emp = rows[0];
    const now = Math.floor(Date.now() / 1000);
    const exp = now + SESSION_TTL_SECONDS;
    const access_token = await signHS256({
      sub: emp.auth_uid, role: "authenticated", aud: "authenticated",
      iat: now, exp, employee_id: emp.id, is_manager: !!emp.is_manager,
    });
    return new Response(JSON.stringify({ access_token, expires_at: exp, employeeId: emp.id, isManager: !!emp.is_manager }), { headers: jsonHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: jsonHeaders });
  }
});
