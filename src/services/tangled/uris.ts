export type AtUriParts = { did: string; collection: string; rkey: string };

export function parseAtUri(atUri: string): AtUriParts | undefined {
  if (!atUri.startsWith("at://")) return undefined;

  const parts = atUri.slice("at://".length).split("/");
  const [did, collection, ...rkeyParts] = parts;
  const rkey = rkeyParts.join("/");

  if (!did || !collection || !rkey) return undefined;

  return { did, collection, rkey };
}

export function getAtUriRkey(atUri: string): string {
  return parseAtUri(atUri)?.rkey ?? atUri;
}
