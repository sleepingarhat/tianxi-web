import { createFileRoute, redirect } from "@tanstack/react-router";

/** 自訂回測已下架：舊連結轉去研究室工具牆。 */
export const Route = createFileRoute("/lab/backtest")({
  beforeLoad: () => {
    throw redirect({ to: "/lab", replace: true });
  },
});
