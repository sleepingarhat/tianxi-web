import { describeError } from "@/lib/error-capture";

type OpsEvent = {
  eventKey: string;
  kind: "api_error" | "model_gate";
  severity: "info" | "warning" | "error";
  source: string;
  message: string;
  route?: string;
  statusCode?: number;
  modelVersion?: string;
  gateKey?: string;
  gateStatus?: "PASS" | "WATCH" | "FAIL";
  metadata?: Record<string, unknown>;
};

const SECRET_PATTERN = /(bearer\s+|token[=:]\s*|api[_-]?key[=:]\s*|authorization[=:]\s*)[^\s,;]+/gi;

export function safeErrorMessage(error: unknown) {
  return describeError(error).replace(SECRET_PATTERN, "$1[REDACTED]").slice(0, 2_000);
}

export async function writeOpsEvent(event: OpsEvent) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("ops_event_history").upsert(
      {
        event_key: event.eventKey.slice(0, 240),
        kind: event.kind,
        severity: event.severity,
        source: event.source.slice(0, 160),
        route: event.route?.slice(0, 300) ?? null,
        status_code: event.statusCode ?? null,
        message: event.message.replace(SECRET_PATTERN, "$1[REDACTED]").slice(0, 2_000),
        model_version: event.modelVersion?.slice(0, 120) ?? null,
        gate_key: event.gateKey?.slice(0, 160) ?? null,
        gate_status: event.gateStatus ?? null,
        metadata: (event.metadata ?? {}) as import('@/integrations/supabase/types').Json,
      },
      { onConflict: "event_key", ignoreDuplicates: true },
    );
    if (error) console.warn("ops history write failed", error.message);
  } catch (error) {
    console.warn("ops history unavailable", error instanceof Error ? error.message : "unknown");
  }
}

export async function recordModelGates(payload: Record<string, any>) {
  const checks: any[] = payload["checks"] ?? payload["gates"] ?? [];
  const version = String(payload["version"] ?? payload["engineVersion"] ?? payload["engine"] ?? "unknown");
  const hour = new Date().toISOString().slice(0, 13);
  await Promise.all(checks.map((check, index) => {
    const raw = String(check.status ?? "WATCH").toUpperCase();
    const status = raw === "PASS" || raw === "FAIL" ? raw : "WATCH";
    const key = String(check.key ?? check.id ?? index);
    return writeOpsEvent({
      eventKey: `gate:${version}:${key}:${status}:${hour}`,
      kind: "model_gate",
      severity: status === "FAIL" ? "error" : status === "WATCH" ? "warning" : "info",
      source: "engine-health",
      message: String(check.note ?? check.detail ?? check.message ?? check.label ?? key),
      modelVersion: version,
      gateKey: key,
      gateStatus: status,
    });
  }));
}
