import { createHighlighter, type Highlighter } from "shiki";
import { sanitizeRichHtml } from "./html.js";

let promise: Promise<Highlighter> | null = null;

export function getHighlighter(): Promise<Highlighter> {
  if (!promise) {
    promise = createHighlighter({ themes: ["github-light", "github-dark"], langs: [] });
  }
  return promise;
}

const LANG_MAP: Record<string, string> = {
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "jsx",
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  tsx: "tsx",
  vue: "vue",
  svelte: "svelte",
  astro: "astro",
  py: "python",
  rb: "ruby",
  rs: "rust",
  go: "go",
  java: "java",
  kt: "kotlin",
  kts: "kotlin",
  swift: "swift",
  c: "c",
  h: "c",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  hpp: "cpp",
  cs: "csharp",
  css: "css",
  scss: "scss",
  sass: "sass",
  less: "less",
  html: "html",
  htm: "html",
  json: "json",
  jsonc: "jsonc",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  xml: "xml",
  svg: "xml",
  md: "markdown",
  mdx: "mdx",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  fish: "fish",
  ps1: "powershell",
  sql: "sql",
  graphql: "graphql",
  gql: "graphql",
  tf: "terraform",
  r: "r",
  lua: "lua",
  php: "php",
  dart: "dart",
  ex: "elixir",
  exs: "elixir",
  erl: "erlang",
  elm: "elm",
  clj: "clojure",
  cljs: "clojure",
  hs: "haskell",
  nix: "nix",
  proto: "proto",
  ini: "ini",
  conf: "ini",
};

export function detectLang(filename: string): string | null {
  const lower = filename.toLowerCase();
  if (lower === "dockerfile" || lower.startsWith("dockerfile.")) return "dockerfile";
  if (lower === "makefile" || lower === "gnumakefile") return "makefile";
  if (lower === "gemfile" || lower === "rakefile") return "ruby";
  if (lower === ".env" || lower.startsWith(".env.")) return "bash";

  const ext = lower.split(".").pop();
  if (!ext || ext === lower) return null;
  return LANG_MAP[ext] ?? null;
}

export async function highlightCode(code: string, filename: string): Promise<string | null> {
  const lang = detectLang(filename);
  if (!lang) return null;

  const hl = await getHighlighter();
  const loaded = hl.getLoadedLanguages();
  if (!loaded.includes(lang as never)) {
    try {
      await hl.loadLanguage(lang as never);
    } catch {
      return null;
    }
  }

  return sanitizeRichHtml(
    hl.codeToHtml(code, { lang, themes: { light: "catppuccin-latte", dark: "catppuccin-mocha" } }),
  );
}
