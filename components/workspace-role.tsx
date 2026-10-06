"use client";

import { createContext, useContext } from "react";

export type WorkspaceRoleName = "OWNER" | "ADMIN" | "MEMBER";

const WorkspaceRoleContext = createContext<WorkspaceRoleName>("MEMBER");

/**
 * The signed-in user's role in the current workspace, set once by the
 * dashboard layout. Only hides controls a member can't use; the API routes
 * enforce the same rule on their own.
 */
export function WorkspaceRoleProvider({
  role,
  children,
}: {
  role: WorkspaceRoleName;
  children: React.ReactNode;
}) {
  return (
    <WorkspaceRoleContext.Provider value={role}>
      {children}
    </WorkspaceRoleContext.Provider>
  );
}

/** Mirrors canManageWorkspace in lib/workspace-access.ts. */
export function useCanManageWorkspace(): boolean {
  const role = useContext(WorkspaceRoleContext);
  return role === "OWNER" || role === "ADMIN";
}
