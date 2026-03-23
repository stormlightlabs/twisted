import { getTwisterApiUrl, hasTwisterApi } from "@/core/config/project.js";

type ErrorPayload = { error?: string; message?: string };

export async function fetchProjectApiJson<T>(path: string, init?: RequestInit): Promise<T> {
  if (!hasTwisterApi) {
    throw new Error("Twister API base URL is not configured.");
  }

  const response = await fetch(getTwisterApiUrl(path), {
    ...init,
    headers: { Accept: "application/json", ...(init?.headers ?? {}) },
  });

  if (!response.ok) {
    const fallbackMessage = `Project API request failed with status ${response.status}.`;

    try {
      const payload = (await response.json()) as ErrorPayload;
      throw new Error(payload.message ?? payload.error ?? fallbackMessage);
    } catch (error) {
      if (error instanceof Error && error.message !== "Unexpected end of JSON input") {
        throw error;
      }

      throw new Error(fallbackMessage, { cause: error });
    }
  }

  return (await response.json()) as T;
}
