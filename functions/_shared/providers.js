export function getProviderConfig(provider, env) {
  if (provider === "google") {
    return {
      name: "google",
      authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenEndpoint: "https://oauth2.googleapis.com/token",
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      scope: "openid email profile",
      usesNonce: true,
      issuer: "https://accounts.google.com",
    };
  }
  if (provider === "github") {
    return {
      name: "github",
      authorizationEndpoint: "https://github.com/login/oauth/authorize",
      tokenEndpoint: "https://github.com/login/oauth/access_token",
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
      scope: null,
      usesNonce: false,
      issuer: "https://github.com",
    };
  }
  return null;
}

export function redirectUriFor(provider, publicBaseUrl) {
  return `${publicBaseUrl}/oauth/callback/${provider}`;
}
