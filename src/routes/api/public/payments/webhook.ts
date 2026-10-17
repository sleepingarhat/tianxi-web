import { createFileRoute } from "@tanstack/react-router";
import { createStripeClient, type StripeEnv, verifyWebhook } from "@/lib/stripe.server";
import { assertDatabaseWrite } from "@/lib/audit-safety";
import { subscriptionSnapshot, webhookSubscriptionId } from "@/lib/subscription-reconciliation";

async function handle(req: Request, environment: StripeEnv) {
  const event = await verifyWebhook(req, environment);
  if (!event.id || !Number.isInteger(event.created)) throw new Error("Invalid event identity");
  const subscriptionId = webhookSubscriptionId(event.type, event.data.object);
  if (!subscriptionId) return;
  // Verified provider event only; ordinary app reads never use this privileged client.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const stripe = createStripeClient(environment);
  for (let attempt = 0; attempt < 3; attempt++) {
    const state = await supabaseAdmin.from("subscription_event_state").select("revision").eq("environment", environment).eq("subscription_id", subscriptionId).maybeSingle();
    assertDatabaseWrite(state);
    // Read AFTER revision: a competing commit invalidates this snapshot atomically.
    // Never replay event payload status; delayed events reconcile current provider state.
    const current = await stripe.subscriptions.retrieve(subscriptionId);
    const snapshot = subscriptionSnapshot(current as unknown as Record<string, any>);
    const result = await supabaseAdmin.rpc("reconcile_subscription_event", {
      _environment: environment, _event_id: event.id, _subscription_id: subscriptionId,
      _expected_revision: state.data?.revision ?? 0, _snapshot: snapshot,
    });
    if (!result.error) return;
    if (!result.error.message.includes("Concurrent reconciliation")) throw new Error(result.error.message);
  }
  throw new Error("Concurrent reconciliation; provider will retry");
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: { handlers: { POST: async ({ request }) => {
    const environment = new URL(request.url).searchParams.get("env");
    if (environment !== "sandbox" && environment !== "live") return new Response("Invalid environment", { status: 400 });
    try { await handle(request, environment); return Response.json({ received: true }); }
    catch (error) { console.error("Subscription reconciliation failed", error); return new Response("Webhook reconciliation failed", { status: 503, headers: { "Cache-Control": "no-store" } }); }
  } } },
});
