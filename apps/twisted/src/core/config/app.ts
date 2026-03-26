type AppEnv = {
  DEV: boolean;
  VITE_TWISTER_API_BASE_URL?: string;
  VITE_OAUTH_CLIENT_ID?: string;
  VITE_OAUTH_REDIRECT_URI?: string;
};

type AppConfig = {
  isDevBuild: boolean;
  isProductionReadOnly: boolean;
  twisterApiBaseUrl: string;
  hasTwisterApi: boolean;
  oauthClientId?: string;
  oauthRedirectUri?: string;
};

const DEFAULT_API_BASE_URL = "https://twister.stormlightlabs.org";

export function normalizeConfiguredUrl(value?: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed.replace(/\/+$/, "");
}

export function createAppConfig(env: AppEnv): AppConfig {
  const twisterApiBaseUrl = normalizeConfiguredUrl(env.VITE_TWISTER_API_BASE_URL) ?? DEFAULT_API_BASE_URL;
  const oauthClientId = normalizeConfiguredUrl(env.VITE_OAUTH_CLIENT_ID);
  const oauthRedirectUri = normalizeConfiguredUrl(env.VITE_OAUTH_REDIRECT_URI);

  return {
    isDevBuild: env.DEV,
    isProductionReadOnly: !env.DEV,
    twisterApiBaseUrl,
    hasTwisterApi: twisterApiBaseUrl.length > 0,
    oauthClientId,
    oauthRedirectUri,
  };
}

export const appConfig = createAppConfig(import.meta.env);
export const isDevBuild = appConfig.isDevBuild;
export const isProductionReadOnly = appConfig.isProductionReadOnly;
export const twisterApiBaseUrl = appConfig.twisterApiBaseUrl;
export const hasTwisterApi = appConfig.hasTwisterApi;
export const oauthClientId = appConfig.oauthClientId;
export const oauthRedirectUri = appConfig.oauthRedirectUri;
