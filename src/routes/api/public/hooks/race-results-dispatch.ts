import { createFileRoute } from "@tanstack/react-router";

/**
 * 準時觸發收賽果：GitHub 自帶排程常遲幾個鐘，改由後端定時任務準時
 * 呼叫 workflow_dispatch 觸發 capy_race_daily（完成後 capy_d1_sync 會自動接力）。
 * 非賽日由倉庫內 fixture_guard 自行跳過；已收齊嘅賽日按場號集合跳過，重跑安全。
 * 只觸發收料，唔改任何凍結預測。
 */
export const Route = createFileRoute("/api/public/hooks/race-results-dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { requireSharedSecret, weatherHookSecrets } =
          await import("@/lib/shared-secret.server");
        const denied = requireSharedSecret(request, weatherHookSecrets());
        if (denied) return denied;

        const { dispatchRaceResults } = await import('@/lib/race-results-dispatch.server');
        return dispatchRaceResults();
      },
    },
  },
});
