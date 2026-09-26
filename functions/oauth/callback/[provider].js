import { sha256Base64Url, generateRandomToken } from "../../_shared/crypto.js";
import {
  parseCookies,
  TX_COOKIE_NAME,
  clearTxCookie,
  buildSessionCookie,
} from "../../_shared/cookies.js";
import { getProviderConfig, redirectUriFor } from "../../_shared/providers.js";
import { validateGoogleIdToken } from "../../_shared/oidc.js";

export async function onRequestGet(context) {
  const { request, params, env } = context;
  const provider = params.provider;

  if (provider !== "google" && provider !== "github") {
    return new Response("Not found", { status: 404 });
  }

  const config = getProviderConfig(provider, env);
  if (!config || !config.clientId) {
    return new Response("Not found", { status: 404 });
  }

  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  // 1. Recusar erro ou ausência de code/state.
  if (error || !code || !state) {
    return new Response("Requisição inválida", { status: 400 });
  }

  // 2. Exigir o cookie de transação.
  const cookies = parseCookies(request);
  const txValue = cookies[TX_COOKIE_NAME];
  if (!txValue) {
    return new Response("Transação ausente", { status: 400 });
  }

  // 3. Localizar a transação pelo resumo do cookie.
  const txIdHash = await sha256Base64Url(txValue);
  const now = Math.floor(Date.now() / 1000);

  const txRow = await env.DB.prepare(
    `SELECT provider, state_hash, nonce, code_verifier, expires_at
     FROM oauth_transactions WHERE id_hash = ?`
  )
    .bind(txIdHash)
    .first();

  if (!txRow || txRow.expires_at < now || txRow.provider !== provider) {
    return new Response("Transação inválida ou expirada", { status: 400 });
  }

  // 4. Comparar o resumo de state.
  const stateHash = await sha256Base64Url(state);
  if (stateHash !== txRow.state_hash) {
    return new Response("State inválido", { status: 400 });
  }

  // 5. Apagar a transação antes de concluir (evita reuso).
  await env.DB.prepare(`DELETE FROM oauth_transactions WHERE id_hash = ?`)
    .bind(txIdHash)
    .run();

  const redirectUri = redirectUriFor(provider, env.PUBLIC_BASE_URL);

  // 6. Trocar o código por tokens.
  const tokenParams = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
    code_verifier: txRow.code_verifier,
  });

  const tokenResponse = await fetch(config.tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: tokenParams.toString(),
  });

  if (!tokenResponse.ok) {
    return new Response("Falha na troca de tokens", { status: 400 });
  }

  const tokenData = await tokenResponse.json();

  let identity;

  if (provider === "google") {
    if (!tokenData.id_token) {
      return new Response("Resposta sem id_token", { status: 400 });
    }
    identity = await validateGoogleIdToken(tokenData.id_token, {
      clientId: config.clientId,
      nonce: txRow.nonce,
    });
  } else {
    // GitHub: usar o access_token para consultar /user, depois revogar.
    if (!tokenData.access_token || !/^bearer$/i.test(tokenData.token_type || "")) {
      return new Response("Resposta de token inválida", { status: 400 });
    }

    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2026-03-10",
        "User-Agent": "oauth-pages-lab",
      },
    });

    if (userResponse.status !== 200) {
      return new Response("Falha ao consultar perfil do GitHub", { status: 400 });
    }

    const userData = await userResponse.json();
    if (typeof userData.id !== "number") {
      return new Response("Perfil do GitHub inválido", { status: 400 });
    }

    identity = {
      subject: String(userData.id),
      email: userData.email || null,
      displayName: userData.name || userData.login || null,
    };

    // Revogar a autorização concedida à OAuth App.
    const basicAuth = btoa(`${config.clientId}:${config.clientSecret}`);
    const revokeResponse = await fetch(
      `https://api.github.com/applications/${config.clientId}/grant`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Basic ${basicAuth}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2026-03-10",
          "User-Agent": "oauth-pages-lab",
        },
        body: JSON.stringify({ access_token: tokenData.access_token }),
      }
    );

    if (revokeResponse.status !== 204) {
      return new Response("Falha ao revogar autorização", { status: 400 });
    }
  }

  // 8. Criar a sessão opaca.
  const sessionId = generateRandomToken();
  const sessionIdHash = await sha256Base64Url(sessionId);
  const sessionExpiresAt = now + 8 * 60 * 60; // 8 horas

  await env.DB.prepare(
    `INSERT INTO sessions (id_hash, issuer, subject, email, display_name, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      sessionIdHash,
      config.issuer,
      identity.subject,
      identity.email,
      identity.displayName,
      sessionExpiresAt,
      now
    )
    .run();

  // 9 e 10. Limpar cookie temporário, redirecionar com o cookie de sessão.
  const headers = new Headers();
  headers.append("Location", env.PUBLIC_BASE_URL);
  headers.append("Set-Cookie", clearTxCookie());
  headers.append("Set-Cookie", buildSessionCookie(sessionId));
  headers.set("Cache-Control", "no-store");

  return new Response(null, { status: 302, headers });
}
