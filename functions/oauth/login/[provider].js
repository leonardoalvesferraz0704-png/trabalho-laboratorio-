import { generateRandomToken, sha256Base64Url } from "../../_shared/crypto.js";
import { buildTxCookie, TX_COOKIE_NAME } from "../../_shared/cookies.js";
import { getProviderConfig, redirectUriFor } from "../../_shared/providers.js";

export async function onRequestGet(context) {
  const { params, env } = context;
  const provider = params.provider;

  if (provider !== "google" && provider !== "github") {
    return new Response("Not found", { status: 404 });
  }

  const config = getProviderConfig(provider, env);
  if (!config || !config.clientId) {
    return new Response("Not found", { status: 404 });
  }

  // Valores aleatórios da transação.
  const txId = generateRandomToken();
  const state = generateRandomToken();
  const codeVerifier = generateRandomToken();
  const nonce = config.usesNonce ? generateRandomToken() : null;

  // PKCE: code_challenge = SHA-256(code_verifier), em Base64URL.
  const codeChallenge = await sha256Base64Url(codeVerifier);

  const txIdHash = await sha256Base64Url(txId);
  const stateHash = await sha256Base64Url(state);

  const expiresAt = Math.floor(Date.now() / 1000) + 600; // 10 minutos

  await env.DB.prepare(
    `INSERT INTO oauth_transactions (id_hash, provider, state_hash, nonce, code_verifier, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(txIdHash, provider, stateHash, nonce, codeVerifier, expiresAt)
    .run();

  const redirectUri = redirectUriFor(provider, env.PUBLIC_BASE_URL);

  const authUrl = new URL(config.authorizationEndpoint);
  authUrl.searchParams.set("client_id", config.clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  if (config.scope) {
    authUrl.searchParams.set("scope", config.scope);
  }
  if (nonce) {
    authUrl.searchParams.set("nonce", nonce);
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: authUrl.toString(),
      "Set-Cookie": buildTxCookie(txId),
      "Cache-Control": "no-store",
    },
  });
}
