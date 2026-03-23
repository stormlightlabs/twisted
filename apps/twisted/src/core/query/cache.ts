import { queryClient } from "./client.js";
import { createIdbPersister } from "./persister.js";

export async function clearAppCache() {
  await queryClient.cancelQueries();
  queryClient.clear();
  await createIdbPersister().removeClient();
}
