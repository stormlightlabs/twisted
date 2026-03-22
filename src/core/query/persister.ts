import { get, set, del } from "idb-keyval";
import type { Persister } from "@tanstack/query-persist-client-core";

const CACHE_KEY = "twisted-query-cache";

export function createIdbPersister(): Persister {
  return {
    persistClient: (client) => set(CACHE_KEY, client),
    restoreClient: () => get(CACHE_KEY),
    removeClient: () => del(CACHE_KEY),
  };
}
