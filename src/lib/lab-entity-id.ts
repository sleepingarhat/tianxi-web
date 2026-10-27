/**
 * 對齊 tianxi-racing validateEntityId（#111）。
 * jockeys.id = `jockey_` + name_ch，後綴可以係中文；舊 `/^jockey_[A-Za-z0-9_-]+$/` 會拒晒。
 * 網站 h2h 入參另外收緊到 64（Worker 上限 128）。
 */
const ENTITY_ID_SUFFIX = /^[\p{L}0-9_-]+$/u;

export function validateEntityId(type: "horse" | "jockey", id: string): boolean {
  const value = id.trim();
  if (!value || value.length > 64) return false;
  const prefix = type === "horse" ? "horse_" : "jockey_";
  if (!value.startsWith(prefix)) return false;
  return ENTITY_ID_SUFFIX.test(value.slice(prefix.length));
}
