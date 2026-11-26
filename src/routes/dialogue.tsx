import { createFileRoute, Outlet } from "@tanstack/react-router";

/** /dialogue 係佈局。帖文清單喺 dialogue.index，單篇回覆喺 dialogue.$postId。 */
export const Route = createFileRoute("/dialogue")({
  component: () => <Outlet />,
});
