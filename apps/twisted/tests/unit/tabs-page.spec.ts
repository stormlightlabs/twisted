import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

async function loadTabsPage(isDevAuthEnabled: boolean) {
  vi.resetModules();
  vi.doMock("@/core/auth/dev-access.ts", () => ({
    useDevAuthFeatures: () => ({
      canToggleDevAuth: true,
      isDevAuthEnabled: ref(isDevAuthEnabled),
      setDevAuthEnabled: vi.fn(),
    }),
  }));
  const module = await import("@/views/TabsPage.vue");
  return module.default;
}

const globalStubs = {
  "ion-page": { template: "<div><slot /></div>" },
  "ion-tabs": { template: "<div><slot /></div>" },
  "ion-router-outlet": { template: "<div />" },
  "ion-tab-bar": { template: "<div><slot /></div>" },
  "ion-tab-button": { template: "<button><slot /></button>" },
  "ion-icon": { template: "<i />" },
  "ion-label": { template: "<span><slot /></span>" },
};

describe("TabsPage", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("@/core/auth/dev-access.ts");
  });

  it("shows Bookmarks in production mode", async () => {
    const TabsPage = await loadTabsPage(false);
    const wrapper = mount(TabsPage, { global: { stubs: globalStubs } });

    expect(wrapper.text()).toContain("Bookmarks");
    expect(wrapper.text()).not.toContain("Profile");
  });

  it("shows Profile in dev mode", async () => {
    const TabsPage = await loadTabsPage(true);
    const wrapper = mount(TabsPage, { global: { stubs: globalStubs } });

    expect(wrapper.text()).toContain("Profile");
  });
});
