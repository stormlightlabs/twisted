/// <reference types="vite/client" />
/// <reference types="@atcute/bluesky" />
/// <reference types="@atcute/tangled" />

declare module "markdown-it" {
  type MarkdownIt = {
    render(content: string): string;
    use(plugin: (...args: any[]) => unknown, ...params: any[]): MarkdownIt;
  };

  type MarkdownItOptions = {
    html?: boolean;
    linkify?: boolean;
    typographer?: boolean;
  };

  const markdownit: (options?: MarkdownItOptions) => MarkdownIt;
  export default markdownit;
}
