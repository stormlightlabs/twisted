import DOMPurify from "dompurify";

const SANITIZE_CONFIG = {
  USE_PROFILES: { html: true },
  ADD_ATTR: ["class", "style"],
};

export function sanitizeRichHtml(html: string): string {
  return stripHtmlComments(DOMPurify.sanitize(html, SANITIZE_CONFIG));
}

export function stripHtmlComments(html: string): string {
  if (typeof DOMParser === "undefined" || typeof NodeFilter === "undefined") {
    return html.replace(/<!--[\s\S]*?-->/g, "");
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<body>${html}</body>`, "text/html");
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_COMMENT);
  const comments: Comment[] = [];

  for (let current = walker.nextNode(); current; current = walker.nextNode()) {
    comments.push(current as Comment);
  }

  for (const comment of comments) {
    comment.parentNode?.removeChild(comment);
  }

  return doc.body.innerHTML;
}
