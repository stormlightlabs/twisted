import js from "@eslint/js";
import pluginVue from "eslint-plugin-vue";
import globals from "globals";
import tseslint from "typescript-eslint";

const isProduction = process.env.NODE_ENV === "production";

export default tseslint.config(
  {
    ignores: [
      "**/.DS_Store",
      "**/node_modules/**",
      "coverage/**",
      "dist/**",
      "ios/**",
      "android/**",
      ".env.local",
      ".env.*.local",
      "npm-debug.log*",
      "yarn-debug.log*",
      "yarn-error.log*",
      "pnpm-debug.log*",
      ".idea/**",
      ".vscode/**",
      "*.suo",
      "*.ntvs*",
      "*.njsproj",
      "*.sln",
      "*.sw?",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended, ...pluginVue.configs["flat/essential"]],
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,vue}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { parser: tseslint.parser },
    },
    rules: {
      "no-console": isProduction ? "warn" : "off",
      "no-debugger": isProduction ? "warn" : "off",
      "@typescript-eslint/no-explicit-any": "off",
      "vue/no-deprecated-slot-attribute": "off",
    },
  },
  { files: ["**/*.cjs"], languageOptions: { sourceType: "commonjs" } },
);
