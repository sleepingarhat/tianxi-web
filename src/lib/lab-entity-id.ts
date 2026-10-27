/**
 * 對齊 tianxi-racing validateEntityId（#111）。
 * jockeys.id／trainers.id = 前綴 + name_ch，後綴可以係中文；舊 ASCII 正則會拒晒。
 * 網站 h2h 入參另外收緊到 64（Worker 上限 128）。
 */
const ENTITY_ID_SUFFIX = /^[\p{L}0-9_-]+$/u;

export type LabEntityType = "horse" | "jockey" | "trainer";

export function validateEntityId(type: LabEntityType, id: string): boolean {
  const value = id.trim();
  if (!value || value.length > 64) return false;
  const prefix = type === "horse" ? "horse_" : type === "jockey" ? "jockey_" : "trainer_";
  if (!value.startsWith(prefix)) return false;
  return ENTITY_ID_SUFFIX.test(value.slice(prefix.length));
}
