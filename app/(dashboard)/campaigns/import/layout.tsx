import { redirectUnlessWorkspaceManager } from "@/lib/workspace-access";

// Members can view campaigns but not create or change them.
export default async function Layout({ children }: { children: React.ReactNode }) {
  await redirectUnlessWorkspaceManager("/campaigns");
  return children;
}
