import { sha256Base64Url } from "../_shared/crypto.js";
import {
  parseCookies,
  SESSION_COOKIE_NAME,
  clearSessionCookie,
} from "../_shared/cookies.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  const origin = request.headers.get("Origin");
  if (origin !== env.PUBLIC_BASE_URL) {
    return new Response("Origem inválida", {
      status: 403,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const cookies = parseCookies(request);
  const sessionValue = cookies[SESSION_COOKIE_NAME];

  if (sessionValue) {
    const sessionIdHash = await sha256Base64Url(sessionValue);
    await env.DB.prepare(`DELETE FROM sessions WHERE id_hash = ?`)
      .bind(sessionIdHash)
      .run();
  }

  return new Response(null, {
    status: 204,
    headers: {
      "Set-Cookie": clearSessionCookie(),
      "Cache-Control": "no-store",
    },
  });
}
