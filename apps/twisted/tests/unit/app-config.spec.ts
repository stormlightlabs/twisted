import { describe, expect, it } from "vitest";
import { createAppConfig, normalizeConfiguredUrl } from "@/core/config/app.ts";

describe("app config", () => {
  it("enables auth in dev", () => {
    const config = createAppConfig({ DEV: true, VITE_TWISTER_API_BASE_URL: "http://127.0.0.1:8080/" });

    expect(config.isDevBuild).toBe(true);
    expect(config.isProductionReadOnly).toBe(false);
    expect(config.twisterApiBaseUrl).toBe("http://127.0.0.1:8080");
  });

  it("disables auth in production", () => {
    const config = createAppConfig({ DEV: false, VITE_TWISTER_API_BASE_URL: "https://twister.stormlightlabs.org/" });

    expect(config.isDevBuild).toBe(false);
    expect(config.isProductionReadOnly).toBe(true);
    expect(config.twisterApiBaseUrl).toBe("https://twister.stormlightlabs.org");
  });

  it("normalizes configured urls", () => {
    expect(normalizeConfiguredUrl("https://example.com///")).toBe("https://example.com");
    expect(normalizeConfiguredUrl("")).toBeUndefined();
  });
});
