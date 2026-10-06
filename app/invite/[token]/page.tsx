import type { Metadata } from "next";
import { getI18n } from "@/lib/i18n/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { normalizeInvitationEmail } from "@/lib/workspace-invitations";
import InvitationAcceptCard from "@/components/invitation-accept-card";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";

type InvitePageProps = {
  params: Promise<{ token: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: t("Accept Workspace Invitation - OpenReply"),
    robots: { index: false, follow: false },
  };
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { t, label } = await getI18n();
  const { token } = await params;
  const [session, invitation] = await Promise.all([
    auth(),
    prisma.workspaceInvitation.findUnique({
      where: { token },
      include: {
        workspace: { select: { name: true } },
      },
    }),
  ]);

  // A new user's first sign-in accepts their pending invites on its own
  // (acceptPendingInvitationsForUser), and "Sign in to accept" returns here
  // afterwards — so the invitee lands on an already accepted invite.
  if (
    invitation?.status === "ACCEPTED" &&
    session?.user?.email &&
    normalizeInvitationEmail(session.user.email) === invitation.email
  ) {
    redirect("/dashboard");
  }

  if (!invitation || invitation.status !== "PENDING") {
    notFound();
  }

  const expired = invitation.expiresAt <= new Date();

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-5 py-12">
        <Link href="/" className="mb-8 text-sm font-bold text-cyan-100">
          OpenReply
        </Link>
        <section className="border border-white/10 bg-white/[0.035] p-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-100">
            {t("Workspace invitation")}
          </p>
          <h1 className="mt-4 text-3xl font-black leading-tight text-white">
            {t("Join {workspace}", { workspace: invitation.workspace.name })}
          </h1>
          <p className="mt-4 text-sm leading-6 text-zinc-400">
            {t("You were invited as {role} for {email}.", { role: label(invitation.role), email: invitation.email })}
          </p>
          <div className="mt-8">
            {expired ? (
              <p className="text-sm text-error">
                {t("This invitation has expired. Ask the workspace owner to resend it.")}
              </p>
            ) : (
              <InvitationAcceptCard
                token={token}
                isSignedIn={Boolean(session?.user?.id)}
                invitedEmail={invitation.email}
              />
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

