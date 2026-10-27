import { createFileRoute, redirect } from "@tanstack/react-router";

/** 彩池優化器已下架：舊連結轉去功能頁工具牆。 */
export const Route = createFileRoute("/lab/pools")({
  beforeLoad: () => {
    throw redirect({ to: "/lab", replace: true });
  },
});
