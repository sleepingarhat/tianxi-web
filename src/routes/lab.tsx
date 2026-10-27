import { createFileRoute, Outlet } from "@tanstack/react-router";

/**
 * 功能頁佈局路由：/lab 嘅工具牆喺 lab.index.tsx；
 * 呢度只係父層，必須渲染 <Outlet /> 先會顯示 /lab/h2h 等子頁。
 */
export const Route = createFileRoute("/lab")({
  component: () => <Outlet />,
});
