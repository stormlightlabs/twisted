import { createApp } from "vue";
import App from "./App.vue";
import router from "@/app/router/index.js";

import { IonicVue } from "@ionic/vue";
import { createPinia } from "pinia";
import { VueQueryPlugin } from "@tanstack/vue-query";
import { queryClient } from "./core/query/client.js";
import { persistQueryClient } from "@tanstack/query-persist-client-core";
import { createIdbPersister } from "./core/query/persister.js";
import { initializeThemePreference } from "./core/theme/preferences.js";
import { useAuthStore } from "./core/auth/store.js";

import "@ionic/vue/css/core.css";
import "@ionic/vue/css/normalize.css";
import "@ionic/vue/css/structure.css";
import "@ionic/vue/css/typography.css";
import "@ionic/vue/css/padding.css";
import "@ionic/vue/css/float-elements.css";
import "@ionic/vue/css/text-alignment.css";
import "@ionic/vue/css/text-transformation.css";
import "@ionic/vue/css/flex-utils.css";
import "@ionic/vue/css/display.css";

/**
 * Ionic Dark Mode
 * -----------------------------------------------------
 * For more info, please see:
 * https://ionicframework.com/docs/theming/dark-mode
 */

/* @import '@ionic/vue/css/palettes/dark.always.css'; */
import "@ionic/vue/css/palettes/dark.class.css";

/* Theme variables */
import "./theme/variables.css";

initializeThemePreference();

if (import.meta.env.DEV) {
  void createIdbPersister().removeClient();
} else {
  persistQueryClient({ queryClient: queryClient as any, persister: createIdbPersister(), maxAge: 30 * 60 * 1000 });
}

const pinia = createPinia();
const app = createApp(App).use(IonicVue).use(router).use(pinia).use(VueQueryPlugin, { queryClient });

const authStore = useAuthStore(pinia);
authStore.initialize();

router.isReady().then(async () => {
  await authStore.restoreSession();
  app.mount("#app");
});
