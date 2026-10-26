// Retired public proxy. Internal research uses the admin-authorized runDrawTune RPC.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/draw-tune")({
  server: {
    handlers: {
      GET: async () => Response.json({ error: "此公開入口已停用" }, {
        status: 410,
        headers: { "Cache-Control": "private, no-store" },
      }),
    },
  },
});
