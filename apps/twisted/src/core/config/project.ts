import { hasTwisterApi, twisterApiBaseUrl } from "./app.ts";

export { hasTwisterApi, twisterApiBaseUrl };

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
