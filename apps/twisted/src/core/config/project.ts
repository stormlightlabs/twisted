const rawTwisterApiBaseUrl = import.meta.env.VITE_TWISTER_API_BASE_URL?.trim() ?? "http://localhost:8080/";

export const twisterApiBaseUrl = rawTwisterApiBaseUrl.replace(/\/+$/, "");
export const hasTwisterApi = twisterApiBaseUrl.length > 0;

export function getTwisterApiUrl(path: string): string {
  if (!hasTwisterApi) {
    throw new Error("Twister API base URL is not configured.");
  }

  return new URL(path.replace(/^\/+/, ""), `${twisterApiBaseUrl}/`).toString();
}
