import { sha256Base64Url } from "../_shared/crypto.js";
import { parseCookies, SESSION_COOKIE_NAME } from "../_shared/cookies.js";

export async function onRequestGet(context) {
  const { request, env } = context;

  const cookies = parseCookies(request);
  const sessionValue = cookies[SESSION_COOKIE_NAME];

  if (!sessionValue) {
    return new Response("Não autenticado", {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const sessionIdHash = await sha256Base64Url(sessionValue);
  const now = Math.floor(Date.now() / 1000);

  const session = await env.DB.prepare(
    `SELECT issuer, subject, email, display_name, expires_at
     FROM sessions WHERE id_hash = ?`
  )
    .bind(sessionIdHash)
    .first();

  if (!session || session.expires_at < now) {
    return new Response("Não autenticado", {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    });
  }

  return Response.json(
    {
      issuer: session.issuer,
      email: session.email,
      displayName: session.display_name,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
