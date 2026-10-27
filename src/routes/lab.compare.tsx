import { createFileRoute, redirect } from "@tanstack/react-router";

/** 策略比較器已下架：舊連結轉去功能頁工具牆。 */
export const Route = createFileRoute("/lab/compare")({
  beforeLoad: () => {
    throw redirect({ to: "/lab", replace: true });
  },
});
