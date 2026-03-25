const rawTwisterApiBaseUrl = import.meta.env.VITE_TWISTER_API_BASE_URL?.trim() ?? "http://localhost:8080/";

export const twisterApiBaseUrl = rawTwisterApiBaseUrl.replace(/\/+$/, "");
export const hasTwisterApi = twisterApiBaseUrl.length > 0;

export function getTwisterApiUrl(path: string): string {
  if (!hasTwisterApi) {
    throw new Error("Twister API base URL is not configured.");
  }

  return new URL(path.replace(/^\/+/, ""), `${twisterApiBaseUrl}/`).toString();
}

export function getTwisterWsUrl(path: string): string {
  if (!hasTwisterApi) {
    throw new Error("Twister API base URL is not configured.");
  }

  const wsBase = twisterApiBaseUrl.replace(/^http/, (m) => (m === "https" ? "wss" : "ws"));
  return new URL(path.replace(/^\/+/, ""), `${wsBase}/`).toString();
}
