import { redirectUnlessWorkspaceManager } from "@/lib/workspace-access";

// Members can view campaigns but not create or change them.
export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  await redirectUnlessWorkspaceManager(`/campaigns/${(await params).id}`);
  return children;
}
