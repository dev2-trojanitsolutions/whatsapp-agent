import catalog from "../data/catalog.json";

export function getKnowledgeBaseContext(): string {
  return JSON.stringify(catalog, null, 2);
}
