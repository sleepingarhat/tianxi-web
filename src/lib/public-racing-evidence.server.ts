/** Fixed public racing projections only; never expose arbitrary query access. */
export async function publicRacingQuery<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const token = process.env["CLOUDFLARE_API_TOKEN"], account = process.env["CLOUDFLARE_ACCOUNT_ID"];
  if (!token || !account) throw new Error("賽馬核對資料暫時未能讀取");
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/d1/database/aad1636e-869a-43f5-aa95-4a19e3aa5517/query`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ sql, params }), signal: AbortSignal.timeout(25_000),
  });
  const body = await response.json() as { success?: boolean; result?: { success?: boolean; results?: T[] }[] };
  if (!response.ok || !body.success || body.result?.[0]?.success === false || !Array.isArray(body.result?.[0]?.results)) throw new Error("賽馬核對資料未能完整讀取");
  return body.result[0].results;
}