<template>
  <div class="markdown-body" v-html="renderedHtml" />
</template>

<script setup lang="ts">
  import { onBeforeUnmount, ref, watch } from "vue";
  import markdownit from "markdown-it";
  import { fromHighlighter } from "@shikijs/markdown-it";
  import { getHighlighter } from "@/lib/syntax.js";
  import { sanitizeRichHtml } from "@/lib/html.js";
  import { resolveRepoImageUrl, type RepoAssetContext } from "@/services/tangled/repo-assets.js";

  const props = defineProps<{ content: string; repoContext?: RepoAssetContext }>();

  let mdPromise: Promise<ReturnType<typeof markdownit>> | null = null;
  let activeObjectUrls: string[] = [];

  const PRELOAD_LANGS = [
    "bash",
    "javascript",
    "typescript",
    "python",
    "json",
    "yaml",
    "html",
    "css",
    "rust",
    "go",
    "sql",
    "markdown",
    "tsx",
    "jsx",
  ] as const;

  async function getMd() {
    if (!mdPromise) {
      mdPromise = (async () => {
        const md = markdownit({ html: true, linkify: true, typographer: true });
        const hl = await getHighlighter();
        await Promise.all(PRELOAD_LANGS.map((l) => hl.loadLanguage(l).catch(() => null)));
        md.use(fromHighlighter(hl, { themes: { light: "github-light", dark: "github-dark" } }));
        return md;
      })();
    }
    return mdPromise;
  }

  const renderedHtml = ref("");

  function revokeObjectUrls(urls: string[] = activeObjectUrls) {
    for (const url of urls) {
      URL.revokeObjectURL(url);
    }

    if (urls === activeObjectUrls) {
      activeObjectUrls = [];
    }
  }

  async function resolveImageSources(
    html: string,
    repoContext?: RepoAssetContext,
  ): Promise<{ html: string; objectUrls: string[] }> {
    if (!repoContext) return { html, objectUrls: [] };

    const parser = new DOMParser();
    const doc = parser.parseFromString(`<body>${html}</body>`, "text/html");
    const objectUrls: string[] = [];
    const images = Array.from(doc.body.querySelectorAll("img[src]"));

    await Promise.all(
      images.map(async (image) => {
        const src = image.getAttribute("src")?.trim();
        if (!src) return;

        const resolved = await resolveRepoImageUrl(repoContext, src);
        if (!resolved) return;

        image.setAttribute("src", resolved.url);
        if (resolved.revoke) objectUrls.push(resolved.url);
      }),
    );

    return { html: doc.body.innerHTML, objectUrls };
  }

  watch(
    () => [props.content, props.repoContext] as const,
    async ([content, repoContext], _, onCleanup) => {
      let cancelled = false;
      const previousUrls = activeObjectUrls;
      const nextUrls: string[] = [];

      onCleanup(() => {
        cancelled = true;
        revokeObjectUrls(nextUrls);
      });

      const md = await getMd();
      const raw = md.render(content);
      const sanitized = sanitizeRichHtml(raw);
      const resolved = await resolveImageSources(sanitized, repoContext);
      nextUrls.push(...resolved.objectUrls);

      if (cancelled) return;

      activeObjectUrls = nextUrls;
      revokeObjectUrls(previousUrls);
      renderedHtml.value = resolved.html;
    },
    { immediate: true },
  );

  onBeforeUnmount(() => {
    revokeObjectUrls();
  });
</script>

<style scoped>
  .markdown-body {
    padding: 0 16px 24px;
    color: var(--t-text-primary);
    font-size: 14px;
    line-height: 1.6;
    word-break: break-word;
  }

  .markdown-body :deep(h1),
  .markdown-body :deep(h2),
  .markdown-body :deep(h3),
  .markdown-body :deep(h4),
  .markdown-body :deep(h5),
  .markdown-body :deep(h6) {
    font-weight: 600;
    line-height: 1.25;
    margin: 24px 0 16px;
    color: var(--t-text-primary);
  }

  .markdown-body :deep(h1) {
    font-size: 2em;
    border-bottom: 1px solid var(--t-border);
    padding-bottom: 0.3em;
  }
  .markdown-body :deep(h2) {
    font-size: 1.5em;
    border-bottom: 1px solid var(--t-border);
    padding-bottom: 0.3em;
  }
  .markdown-body :deep(h3) {
    font-size: 1.25em;
  }

  .markdown-body :deep(p) {
    margin: 0 0 16px;
  }

  .markdown-body :deep(a) {
    color: var(--t-accent);
    text-decoration: none;
  }

  .markdown-body :deep(a:hover) {
    text-decoration: underline;
  }

  .markdown-body :deep(code) {
    font-family: var(--t-mono);
    font-size: 0.875em;
    background: var(--t-surface-raised);
    border: 1px solid var(--t-border);
    border-radius: 4px;
    padding: 0.1em 0.4em;
  }

  .markdown-body :deep(pre) {
    margin: 0 0 16px;
    border-radius: var(--t-radius-md);
    border: 1px solid var(--t-border);
    overflow-x: auto;
  }

  .markdown-body :deep(pre code) {
    background: transparent;
    border: none;
    padding: 0;
    font-size: 12px;
  }

  .markdown-body :deep(.shiki) {
    padding: 16px;
    background: var(--t-surface-raised) !important;
    font-family: var(--t-mono);
    font-size: 12px;
    line-height: 1.6;
    tab-size: 2;
  }

  .markdown-body :deep(.shiki span) {
    color: var(--shiki-light);
  }

  @media (prefers-color-scheme: dark) {
    .markdown-body :deep(.shiki) {
      background: var(--t-surface-raised) !important;
    }

    .markdown-body :deep(.shiki span) {
      color: var(--shiki-dark);
    }
  }

  .markdown-body :deep(blockquote) {
    margin: 0 0 16px;
    padding: 0 16px;
    border-left: 4px solid var(--t-border);
    color: var(--t-text-secondary);
  }

  .markdown-body :deep(ul),
  .markdown-body :deep(ol) {
    margin: 0 0 16px;
    padding-left: 2em;
  }

  .markdown-body :deep(li) {
    margin: 4px 0;
  }

  .markdown-body :deep(table) {
    width: 100%;
    border-collapse: collapse;
    margin: 0 0 16px;
    font-size: 13px;
    overflow-x: auto;
    display: block;
  }

  .markdown-body :deep(th),
  .markdown-body :deep(td) {
    padding: 6px 12px;
    border: 1px solid var(--t-border);
    text-align: left;
  }

  .markdown-body :deep(th) {
    background: var(--t-surface-raised);
    font-weight: 600;
  }

  .markdown-body :deep(tr:nth-child(even) td) {
    background: var(--t-surface-raised);
  }

  .markdown-body :deep(img) {
    max-width: 100%;
    border-radius: var(--t-radius-md);
  }

  .markdown-body :deep(hr) {
    border: none;
    border-top: 1px solid var(--t-border);
    margin: 24px 0;
  }
</style>
