/// <reference types="vite/client" />
/// <reference types="@atcute/bluesky" />
/// <reference types="@atcute/tangled" />

interface ImportMetaEnv {
  readonly VITE_TWISTER_API_BASE_URL?: string;
  readonly VITE_OAUTH_CLIENT_ID?: string;
  readonly VITE_OAUTH_REDIRECT_URI?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "markdown-it" {
  type MarkdownIt = {
    render(content: string): string;
    use(plugin: (...args: any[]) => unknown, ...params: any[]): MarkdownIt;
  };

  type MarkdownItOptions = { html?: boolean; linkify?: boolean; typographer?: boolean };

  const markdownit: (options?: MarkdownItOptions) => MarkdownIt;
  export default markdownit;
}
