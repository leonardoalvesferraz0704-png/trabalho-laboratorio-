import { fromBase64Url } from "./crypto.js";

const GOOGLE_DISCOVERY_URL = "https://accounts.google.com/.well-known/openid-configuration";

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`Falha ao buscar ${url}: ${response.status}`);
  }
  return response.json();
}

export async function validateGoogleIdToken(idToken, { clientId, nonce }) {
  const parts = idToken.split(".");
  if (parts.length !== 3) {
    throw new Error("Formato de id_token inválido");
  }
  const [headerB64, payloadB64, signatureB64] = parts;

  const header = JSON.parse(new TextDecoder().decode(fromBase64Url(headerB64)));
  if (header.alg !== "RS256") {
    throw new Error("Algoritmo inesperado no id_token");
  }

  const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(payloadB64)));

  const discovery = await fetchJson(GOOGLE_DISCOVERY_URL);
  const jwks = await fetchJson(discovery.jwks_uri);

  const jwk = jwks.keys.find((key) => key.kid === header.kid);
  if (!jwk) {
    throw new Error("Chave pública correspondente não encontrada");
  }

  const publicKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const signedData = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signature = fromBase64Url(signatureB64);

  const isValid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    publicKey,
    signature,
    signedData
  );
  if (!isValid) {
    throw new Error("Assinatura do id_token inválida");
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.iss !== discovery.issuer) {
    throw new Error("Emissor inválido");
  }
  if (payload.aud !== clientId) {
    throw new Error("Audiência inválida");
  }
  if (typeof payload.exp !== "number" || payload.exp < now) {
    throw new Error("Token expirado");
  }
  if (typeof payload.iat !== "number" || payload.iat > now + 60) {
    throw new Error("iat inválido");
  }
  if (payload.nonce !== nonce) {
    throw new Error("Nonce inválido");
  }

  return {
    subject: payload.sub,
    email: payload.email || null,
    displayName: payload.name || payload.email || null,
  };
}
