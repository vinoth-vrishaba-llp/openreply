import { NextResponse } from "next/server";
import { getCurrentWorkspaceId } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import {
  canManageWorkspace,
  getCurrentWorkspaceContext,
} from "@/lib/workspace-access";
import { HOURLY_CAP_CEILING, isValidHourlyCap } from "@/lib/utils/hourly-cap";

export const runtime = "nodejs";

/**
 * The workspace's connected Instagram accounts — just enough for an account
 * selector. This is a single indexed query, unlike /api/dashboard/stats which
 * runs the full analytics aggregation. Pages that only need the account list
 * (e.g. the inbox) should use this so they aren't gated on heavy stats.
 */
export async function GET() {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const instagramAccounts = await prisma.instagramAccount.findMany({
    where: { workspaceId },
    orderBy: { connectedAt: "desc" },
    select: { id: true, username: true, instagramId: true, name: true },
  });

  return NextResponse.json({
    success: true,
    data: {
      instagramAccounts,
      selectedInstagramAccountId: instagramAccounts[0]?.id ?? null,
    },
  });
}

/**
 * Set or clear one account's hourly DM cap. `hourlyDmCap: null` goes back to
 * the instance default. Owners and admins only, like connect and disconnect.
 */
export async function PATCH(request: Request) {
  const context = await getCurrentWorkspaceContext();
  if (!context) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }
  if (!canManageWorkspace(context.role)) {
    return NextResponse.json(
      { success: false, error: "Only owners and admins can change DM limits" },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const instagramAccountId =
    typeof body.instagramAccountId === "string" ? body.instagramAccountId : null;
  const cap = body.hourlyDmCap;

  if (!instagramAccountId || (cap !== null && !isValidHourlyCap(cap))) {
    return NextResponse.json(
      {
        success: false,
        error: `Hourly cap must be a whole number from 1 to ${HOURLY_CAP_CEILING}`,
      },
      { status: 400 }
    );
  }

  const result = await prisma.instagramAccount.updateMany({
    where: { id: instagramAccountId, workspaceId: context.workspaceId },
    data: { hourlyDmCap: cap },
  });
  if (result.count === 0) {
    return NextResponse.json(
      { success: false, error: "Account not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, data: { hourlyDmCap: cap } });
}
