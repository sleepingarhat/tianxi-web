import { describe, expect, it } from "vitest";
import { subscriptionSnapshot, webhookSubscriptionId } from "./subscription-reconciliation";
describe("provider subscription reconciliation", () => {
  it("normalizes failed-invoice subscription identity", () => {
    expect(webhookSubscriptionId("invoice.payment_failed", { parent: { subscription_details: { subscription: { id: "sub_1" } } } })).toBe("sub_1");
    expect(webhookSubscriptionId("invoice.payment_failed", { subscription: "sub_2" })).toBe("sub_2");
  });
  it("does not treat a one-off invoice as a subscription", () => {
    expect(webhookSubscriptionId("invoice.payment_failed", {})).toBeNull();
  });
  it("uses authoritative snapshot failure and cancellation states", () => {
    const base = { metadata: { userId: "00000000-0000-0000-0000-000000000001" }, items: { data: [{ price: { id: "price_1", product: "prod_1" } }] }, customer: "cus_1" };
    expect(subscriptionSnapshot({ ...base, status: "past_due" }).status).toBe("past_due");
    expect(subscriptionSnapshot({ ...base, status: "canceled" }).status).toBe("canceled");
    expect(() => subscriptionSnapshot({ ...base, metadata: {} })).toThrow();
  });
});