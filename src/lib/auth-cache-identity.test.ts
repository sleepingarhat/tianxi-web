import { describe, expect, it } from "vitest";
import { authCacheAction } from "./auth-cache-identity";

describe("authCacheAction", () => {
  it("does not clear when the same member's tab becomes visible again", () => {
    expect(authCacheAction("user-a", "SIGNED_IN", "user-a").action).toBe("none");
  });
  it("does not clear on the first known session", () => {
    expect(authCacheAction(undefined, "SIGNED_IN", "user-a")).toEqual({ action: "none", identity: "user-a" });
  });
  it("clears private reads when a visitor signs in", () => {
    expect(authCacheAction(null, "SIGNED_IN", "user-a").action).toBe("clear-private");
  });
  it("clears private reads when the account switches", () => {
    expect(authCacheAction("user-a", "SIGNED_IN", "user-b").action).toBe("clear-private");
  });
  it("always clears on sign-out", () => {
    expect(authCacheAction("user-a", "SIGNED_OUT", null).action).toBe("sign-out");
    expect(authCacheAction(undefined, "SIGNED_OUT", null).action).toBe("sign-out");
  });
  it("ignores token refresh for the same member", () => {
    expect(authCacheAction("user-a", "TOKEN_REFRESHED", "user-a").action).toBe("none");
  });
});
