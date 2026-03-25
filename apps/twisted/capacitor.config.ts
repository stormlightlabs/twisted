import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "io.ionic.starter",
  appName: "Twisted",
  webDir: "dist",
  server: { androidScheme: "io.ionic.starter" },
  plugins: { CapacitorHttp: { enabled: true } },
};

export default config;
