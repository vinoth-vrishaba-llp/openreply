import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockInvitationFindFirst, mockMemberFindFirst } = vi.hoisted(() => ({
  mockInvitationFindFirst: vi.fn(),
  mockMemberFindFirst: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  prisma: {
    workspaceInvitation: { findFirst: mockInvitationFindFirst },
    workspaceMember: { findFirst: mockMemberFindFirst },
  },
}));

import { isEmailInvitedOrMember } from "../lib/workspace";

beforeEach(() => {
  vi.clearAllMocks();
  mockInvitationFindFirst.mockResolvedValue(null);
  mockMemberFindFirst.mockResolvedValue(null);
});

describe("isEmailInvitedOrMember", () => {
  it("lets in someone with a live invitation", async () => {
    mockInvitationFindFirst.mockResolvedValue({ id: "inv_1" });
    await expect(isEmailInvitedOrMember("friend@example.com")).resolves.toBe(true);
  });

  it("only counts pending, unexpired invitations, matched on the normalized email", async () => {
    await isEmailInvitedOrMember("  Friend@Example.COM ");
    const { where } = mockInvitationFindFirst.mock.calls[0][0];
    expect(where.email).toBe("friend@example.com");
    expect(where.status).toBe("PENDING");
    expect(where.expiresAt.gt).toBeInstanceOf(Date);
  });

  it("lets in an accepted teammate on their next sign-in", async () => {
    mockMemberFindFirst.mockResolvedValue({ id: "member_1" });
    await expect(isEmailInvitedOrMember("friend@example.com")).resolves.toBe(true);
  });

  it("does not count owning your own workspace as being invited", async () => {
    await isEmailInvitedOrMember("stranger@example.com");
    const { where } = mockMemberFindFirst.mock.calls[0][0];
    expect(where.role).toEqual({ not: "OWNER" });
  });

  it("refuses everyone else", async () => {
    await expect(isEmailInvitedOrMember("stranger@example.com")).resolves.toBe(false);
  });

  it("refuses a missing email without querying", async () => {
    await expect(isEmailInvitedOrMember(null)).resolves.toBe(false);
    await expect(isEmailInvitedOrMember("")).resolves.toBe(false);
    expect(mockInvitationFindFirst).not.toHaveBeenCalled();
  });
});
