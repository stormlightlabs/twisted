import { configureOAuth } from "@atcute/oauth-browser-client";
import {
  LocalActorResolver,
  CompositeDidDocumentResolver,
  CompositeHandleResolver,
  PlcDidDocumentResolver,
  WebDidDocumentResolver,
  WellKnownHandleResolver,
  DohJsonHandleResolver,
} from "@atcute/identity-resolver";
import { oauthClientId, oauthRedirectUri } from "@/core/config/app.js";

const isNative = typeof window !== "undefined" && !window.location.origin.startsWith("http");
const baseUrl = isNative ? "io.ionic.starter://" : window.location.origin;
const clientId = (!isNative && oauthClientId) || `${baseUrl}/client-metadata.json`;
const redirectUri = (!isNative && oauthRedirectUri) || `${baseUrl}/oauth-callback`;

const didResolver = new CompositeDidDocumentResolver({
  methods: { plc: new PlcDidDocumentResolver(), web: new WebDidDocumentResolver() },
});

const handleResolver = new CompositeHandleResolver({
  strategy: "race",
  methods: {
    http: new WellKnownHandleResolver(),
    dns: new DohJsonHandleResolver({ dohUrl: "https://cloudflare-dns.com/dns-query" }),
  },
});

const actorResolver = new LocalActorResolver({ didDocumentResolver: didResolver, handleResolver });

export function initializeOAuth(): void {
  configureOAuth({
    metadata: { client_id: clientId, redirect_uri: redirectUri },
    identityResolver: actorResolver,
    storageName: "twisted-oauth",
  });
}

export { clientId, redirectUri };
