import { describe, expect, it } from "vitest";

import { isClientAbort, isStaleClientBuild } from "./server-error-class";

describe("伺服器錯誤分類", () => {
  it("舊版本伺服器函數編號屬客戶端版本過期", () => {
    const error = new Error(
      "Invalid server function ID: eyJmaWxlIjoiL3NyYy9saWIvcmFjZWNvdXJzZVBob3Rvcy5mdW5jdGlvbnMudHM_dHNzLXNlcnZlcmZuLXNwbGl0IiwiZXhwb3J0IjoiZ2V0UmFjZWNvdXJzZVBob3RvcyJ9",
    );
    expect(isStaleClientBuild(error)).toBe(true);
    expect(isClientAbort(error, false)).toBe(false);
  });

  it("一般後端錯誤唔屬客戶端版本過期", () => {
    expect(isStaleClientBuild(new Error("database unreachable"))).toBe(false);
    expect(isStaleClientBuild(null)).toBe(false);
    expect(isStaleClientBuild("Invalid server function ID: x")).toBe(true);
  });

  it("訪客斷線屬 abort，唔當伺服器錯誤", () => {
    expect(isClientAbort(new Error("aborted"), false)).toBe(true);
    expect(isClientAbort(new Error("This operation was aborted"), false)).toBe(true);
    expect(isClientAbort(new Error("database unreachable"), false)).toBe(false);
    expect(isClientAbort(new Error("database unreachable"), true)).toBe(true);
  });
});
