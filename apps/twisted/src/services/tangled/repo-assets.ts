import { fetchRepoBlob } from "./endpoints.js";
import { normalizeBlob, type BlobContent } from "./normalizers.js";

export type RepoAssetContext = {
  owner: string;
  repo: string;
  branch: string;
  knotHost: string;
  knotRepo: string;
  sourcePath?: string;
};

const EXTERNAL_URL_RE = /^(?:[a-z][a-z0-9+.-]*:)?\/\//i;
const SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;

export function isRenderableImage(blob: Pick<BlobContent, "mimeType">): boolean {
  return !!blob.mimeType?.toLowerCase().startsWith("image/");
}

export function createObjectUrlFromBlobContent(blob: BlobContent): string | null {
  if (!isRenderableImage(blob)) return null;

  const browserBlob = toBrowserBlob(blob);
  if (!browserBlob) return null;

  return URL.createObjectURL(browserBlob);
}

export function buildPublicRawUrl(context: RepoAssetContext, repoPath: string): string {
  const owner = encodeURIComponent(context.owner);
  const repo = encodeURIComponent(context.repo);
  const branch = encodeURIComponent(context.branch);
  const path = repoPath
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `https://tangled.org/${owner}/${repo}/raw/${branch}/${path}`;
}

export function resolveRepoRelativePath(sourcePath: string | undefined, src: string): string | null {
  const value = src.trim();
  if (!value || value.startsWith("#") || value.startsWith("data:") || value.startsWith("blob:")) return null;
  if (EXTERNAL_URL_RE.test(value) || SCHEME_RE.test(value)) return null;

  const [pathOnly] = value.split(/[?#]/, 1);
  if (!pathOnly) return null;

  const baseSegments = value.startsWith("/")
    ? []
    : (sourcePath ? dirname(sourcePath).split("/").filter(Boolean) : []);

  const segments = pathOnly.replace(/^\/+/, "").split("/");
  const resolved = [...baseSegments];

  for (const segment of segments) {
    if (!segment || segment === ".") continue;

    if (segment === "..") {
      if (!resolved.length) return null;
      resolved.pop();
      continue;
    }

    resolved.push(segment);
  }

  return resolved.join("/");
}

export async function resolveRepoImageUrl(
  context: RepoAssetContext,
  src: string,
): Promise<{ url: string; revoke: boolean } | null> {
  const repoPath = resolveRepoRelativePath(context.sourcePath, src);
  if (!repoPath) return null;

  try {
    const blob = normalizeBlob(await fetchRepoBlob(context.knotHost, {
      repo: context.knotRepo,
      ref: context.branch,
      path: repoPath,
    }));

    const objectUrl = createObjectUrlFromBlobContent(blob);
    if (objectUrl) return { url: objectUrl, revoke: true };
  } catch {
    // Fall back to the public raw URL if the XRPC lookup fails.
  }

  return { url: buildPublicRawUrl(context, repoPath), revoke: false };
}

function dirname(path: string): string {
  const segments = path.split("/").filter(Boolean);
  segments.pop();
  return segments.join("/");
}

function toBrowserBlob(blob: BlobContent): Blob | null {
  const type = blob.mimeType ?? "application/octet-stream";

  if (blob.encoding === "base64") {
    try {
      const binary = atob(blob.content);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      return new Blob([bytes], { type });
    } catch {
      return null;
    }
  }

  return new Blob([blob.content], { type });
}
