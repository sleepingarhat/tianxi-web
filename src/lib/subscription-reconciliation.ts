export function webhookSubscriptionId(type: string, object: Record<string, any>): string | null {
  if (["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(type)) {
    if (typeof object['id'] !== "string") throw new Error("Missing subscription identity");
    return object['id'];
  }
  if (type !== "invoice.payment_failed") return null;
  const value = object['parent']?.subscription_details?.subscription ?? object['subscription'];
  if (!value) return null; // one-off invoices have no subscription
  const id = typeof value === "string" ? value : value.id;
  if (typeof id !== "string") throw new Error("Invalid subscription identity");
  return id;
}

export function subscriptionSnapshot(subscription: Record<string, any>) {
  const userId = subscription['metadata']?.userId;
  if (typeof userId !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(userId)) throw new Error("Missing verified member identity");
  const item = subscription['items']?.data?.[0];
  const iso = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? new Date(value * 1000).toISOString() : null;
  const price = item?.price;
  const customer = subscription['customer'];
  if (!["active", "trialing", "past_due", "unpaid", "incomplete", "incomplete_expired", "paused", "canceled"].includes(subscription['status']) || !(typeof customer === "string" ? customer : customer?.id) || !price?.id || !price?.product) throw new Error("Incomplete authoritative subscription snapshot");
  return {
    user_id: userId,
    stripe_customer_id: typeof customer === "string" ? customer : customer?.id,
    price_id: price?.lookup_key || price?.metadata?.lovable_external_id || price?.id,
    product_id: typeof price?.product === "string" ? price.product : price?.product?.id,
    status: subscription['status'],
    current_period_start: iso(item?.current_period_start ?? subscription['current_period_start']),
    current_period_end: iso(item?.current_period_end ?? subscription['current_period_end']),
    cancel_at_period_end: subscription['cancel_at_period_end'] === true,
  };
}