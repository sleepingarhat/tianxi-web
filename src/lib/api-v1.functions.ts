import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireTier } from "./tier.server";

const createInput = z.object({
  label: z.string().trim().max(64).optional(),
  scopes: z.string().trim().max(128).optional(),
});

const idInput = z.object({
  id: z.string().trim().min(1).max(80),
});

export type ApiKeyPublic = {
  id: string;
  keyPrefix: string;
  scopes: string;
  entitlementUntil: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  label: string | null;
};

export type ApiUsageRow = {
  keyId: string;
  date: string;
  count: number;
};

/** Pro：建立 API key（明文只回一次）。 */
export const createApiKey = createServerFn({ method: "POST" })
  .middleware([requireTier("pro")])
  .inputValidator((data: unknown) => createInput.parse(data ?? {}))
  .handler(async ({ data, context }) => {
    const { workerFetch, WORKER_BASE } = await import("./site-reader.server");
    const r = await workerFetch(`${WORKER_BASE}/api/v1/admin/keys`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        userId: context.userId,
        label: data.label ?? null,
        scopes: data.scopes,
      }),
    });
    const body = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    if (!r.ok) {
      throw new Error(String(body["message"] ?? body["error"] ?? `建立失敗（${r.status}）`));
    }
    return {
      id: String(body["id"] ?? ""),
      keyPrefix: String(body["keyPrefix"] ?? ""),
      apiKey: String(body["apiKey"] ?? ""),
      scopes: String(body["scopes"] ?? ""),
      entitlementUntil: (body["entitlementUntil"] as string | null) ?? null,
      createdAt: String(body["createdAt"] ?? ""),
      label: (body["label"] as string | null) ?? null,
      note: String(body["note"] ?? "請立即保存；之後無法再讀取明文。"),
      disclaimer: String(body["disclaimer"] ?? ""),
    };
  });

/** Pro：列出自己嘅 keys 同用量。 */
export const listApiKeys = createServerFn({ method: "GET" })
  .middleware([requireTier("pro")])
  .handler(async ({ context }) => {
    const { workerFetch, WORKER_BASE } = await import("./site-reader.server");
    const qs = new URLSearchParams({ userId: context.userId });
    const r = await workerFetch(`${WORKER_BASE}/api/v1/admin/keys?${qs}`, { method: "GET" });
    const body = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    if (!r.ok) {
      throw new Error(String(body["message"] ?? body["error"] ?? `讀取失敗（${r.status}）`));
    }
    return {
      keys: (body["keys"] as ApiKeyPublic[]) ?? [],
      usage: (body["usage"] as ApiUsageRow[]) ?? [],
      limits: (body["limits"] as { perMinute: number; perDay: number }) ?? {
        perMinute: 60,
        perDay: 5000,
      },
    };
  });

/** Pro：撤銷 key。 */
export const revokeApiKey = createServerFn({ method: "POST" })
  .middleware([requireTier("pro")])
  .inputValidator((data: unknown) => idInput.parse(data))
  .handler(async ({ data }) => {
    const { workerFetch, WORKER_BASE } = await import("./site-reader.server");
    const r = await workerFetch(
      `${WORKER_BASE}/api/v1/admin/keys/${encodeURIComponent(data.id)}/revoke`,
      { method: "POST" },
    );
    const body = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    if (!r.ok) {
      throw new Error(String(body["message"] ?? body["error"] ?? `撤銷失敗（${r.status}）`));
    }
    return {
      id: String(body["id"] ?? data.id),
      revokedAt: (body["revokedAt"] as string | null) ?? null,
      alreadyRevoked: Boolean(body["alreadyRevoked"]),
    };
  });
