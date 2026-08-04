import { QdrantClient } from "@qdrant/js-client-rest";

let client: QdrantClient | undefined;

export function getQdrantClient() {
  const url = process.env.QDRANT_URL;
  const apiKey = process.env.QDRANT_API_KEY;
  if (!url || !apiKey) throw new Error("QDRANT_URL and QDRANT_API_KEY are not configured");
  client ??= new QdrantClient({ url, apiKey });
  return client;
}

export async function qdrantHealth() {
  const result = await getQdrantClient().getCollections();
  return { ok: true, collections: result.collections.length };
}
