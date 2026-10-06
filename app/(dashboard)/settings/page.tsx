"use client";

import LanguageSwitcher from "@/components/language-switcher";
import { useI18n } from "@/lib/i18n/provider";
import { Suspense, useEffect, useState } from "react";
import type { AccountOption } from "@/components/account-select";
import { ZernioConnection } from "@/components/zernio-connection";
import { InstagramConnectNotice } from "@/components/instagram-connect-notice";
import { useCanManageWorkspace } from "@/components/workspace-role";

interface SettingsData {
  workspace: {
    name: string;
    dmsSentThisPeriod: number;
  };
  instagramAccount: {
    id: string;
    username: string;
    instagramId: string;
    tokenExpiresAt: string | null;
    webhookSubscribed: boolean;
  } | null;
  instagramAccounts: Array<
    AccountOption & {
      provider?: "META" | "ZERNIO";
      tokenExpiresAt: string | null;
      webhookSubscribed: boolean;
      hourlyDmCap: number | null;
    }
  >;
  defaultHourlyDmCap: number;
}

interface WorkspaceMembersData {
  currentUserRole: "OWNER" | "ADMIN" | "MEMBER";
  currentUserId: string;
  members: Array<{
    id: string;
    role: "OWNER" | "ADMIN" | "MEMBER";
    createdAt: string;
    user: {
      id: string;
      email: string | null;
      name: string | null;
    };
  }>;
  invitations: Array<{
    id: string;
    email: string;
    role: "OWNER" | "ADMIN" | "MEMBER";
    inviteUrl: string;
    expiresAt: string;
  }>;
}

export default function SettingsPage() {
  const { t, label, locale } = useI18n();
  const canManageMembers = useCanManageWorkspace();
  const [data, setData] = useState<SettingsData | null>(null);
  const [membersData, setMembersData] = useState<WorkspaceMembersData | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"ADMIN" | "MEMBER">("MEMBER");
  const [memberError, setMemberError] = useState<string | null>(null);
  const [capDrafts, setCapDrafts] = useState<Record<string, string>>({});
  const [capError, setCapError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/dashboard/stats").then((res) => res.json()),
      fetch("/api/workspace/members").then((res) => res.json()),
    ])
      .then(([statsPayload, membersPayload]) => {
        if (statsPayload.success) setData(statsPayload.data);
        if (membersPayload.success) setMembersData(membersPayload.data);
      })
      .finally(() => setLoading(false));
  }, []);

  async function refreshMembers() {
    const res = await fetch("/api/workspace/members");
    const payload = await res.json();
    if (payload.success) setMembersData(payload.data);
  }

  async function disconnectInstagram(instagramAccountId: string) {
    if (!confirm(t("Disconnect Instagram? Campaigns for this account will stop sending DMs."))) {
      return;
    }

    setBusy(`disconnect:${instagramAccountId}`);
    await fetch("/api/instagram/disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instagramAccountId }),
    });
    window.location.reload();
  }

  async function saveHourlyCap(instagramAccountId: string) {
    const draft = capDrafts[instagramAccountId];
    if (draft === undefined) return;
    const trimmed = draft.trim();
    setCapError(null);
    setBusy(`cap:${instagramAccountId}`);
    const res = await fetch("/api/instagram/accounts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instagramAccountId,
        hourlyDmCap: trimmed === "" ? null : Number(trimmed),
      }),
    });
    const payload = await res.json();
    if (payload.success) {
      setData((current) =>
        current
          ? {
              ...current,
              instagramAccounts: current.instagramAccounts.map((account) =>
                account.id === instagramAccountId
                  ? { ...account, hourlyDmCap: payload.data.hourlyDmCap }
                  : account
              ),
            }
          : current
      );
      setCapDrafts((drafts) => {
        const rest = { ...drafts };
        delete rest[instagramAccountId];
        return rest;
      });
    } else {
      setCapError(payload.error ?? t("Could not save the limit"));
    }
    setBusy(null);
  }

  async function inviteMember(event: React.FormEvent) {
    event.preventDefault();
    setMemberError(null);
    setBusy("invite");
    const res = await fetch("/api/workspace/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
    });
    const payload = await res.json();
    if (payload.success) {
      setMembersData(payload.data);
      setInviteEmail("");
    } else {
      setMemberError(payload.error ?? t("Could not invite member"));
    }
    setBusy(null);
  }

  async function updateMember(
    memberId: string,
    change: { role: "ADMIN" | "MEMBER" } | "remove"
  ) {
    if (
      change === "remove" &&
      !confirm(t("Remove this member? They lose access to this workspace."))
    ) {
      return;
    }
    setMemberError(null);
    setBusy(`member:${memberId}`);
    const res = await fetch("/api/workspace/members", {
      method: change === "remove" ? "DELETE" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        change === "remove" ? { memberId } : { memberId, role: change.role }
      ),
    });
    const payload = await res.json();
    if (payload.success) {
      setMembersData(payload.data);
    } else {
      setMemberError(payload.error ?? t("Could not update member"));
    }
    setBusy(null);
  }

  async function removeInvitation(invitationId: string) {
    setBusy(`invite:${invitationId}`);
    await fetch("/api/workspace/members", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invitationId }),
    });
    await refreshMembers();
    setBusy(null);
  }

  if (loading) {
    return <div className="panel rounded p-8 h-64" />;
  }

  const accounts = data?.instagramAccounts ?? [];

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Surfaces the ?instagram= code the OAuth routes redirect back with.
          Needs a Suspense boundary: useSearchParams in a prerendered client
          page fails the production build without one. */}
      <Suspense fallback={null}>
        <InstagramConnectNotice />
      </Suspense>

      <section className="panel rounded p-4 sm:p-6 space-y-3">
        <h2 className="text-base font-semibold">{t("Interface language")}</h2>
        <LanguageSwitcher />
        <p className="text-sm text-muted">{t("Saved in this browser. Campaign messages stay unchanged.")}</p>
      </section>

      <ZernioConnection canManage={canManageMembers} />

      <section className="panel rounded p-4 sm:p-6">
        <h2 className="text-base font-semibold mb-6">{t("Instagram Connection")}</h2>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 py-3 border-b border-border">
            <div>
              <p className="text-sm font-medium text-foreground">{t("Status")}</p>
              <p className="text-xs text-muted mt-0.5">
                {t("Comment webhooks and private replies depend on this connection.")}
              </p>
            </div>
            <span
              className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                accounts.length > 0
                  ? "bg-success/10 text-success"
                  : "bg-warning/10 text-warning"
              }`}
            >
              {accounts.length > 0 ? t("Connected") : t("Not connected")}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 py-3 border-b border-border">
            <div>
              <p className="text-sm font-medium text-foreground">{t("Accounts")}</p>
              <p className="text-xs text-muted mt-0.5">
                {t(accounts.length === 1 ? "{count} connected Instagram profile" : "{count} connected Instagram profiles", { count: accounts.length })}
              </p>
            </div>
            <span className="text-sm text-muted">
              {accounts.length > 0 ? t("{count} connected", { count: accounts.length }) : t("None")}
            </span>
          </div>

          <div className="space-y-3 py-3">
            {accounts.length === 0 && (
              <p className="text-sm text-muted">
                {t("Connect an Instagram professional account to launch campaigns.")}
              </p>
            )}
            {accounts.map((account) => (
              <div
                key={account.id}
                className="flex flex-col gap-3 rounded border border-border bg-surface/70 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    @{account.username}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {account.provider === "ZERNIO" ? t("Connected via Zernio") : <>{t("Token expires")}{" "}
                    {account.tokenExpiresAt
                      ? new Date(account.tokenExpiresAt).toLocaleDateString(locale)
                      : t("not available")}</>}{" "}
                    · {account.webhookSubscribed ? t("Webhook ready") : t("Webhook pending")}
                  </p>
                  {canManageMembers && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <label
                        htmlFor={`cap-${account.id}`}
                        className="text-xs text-muted"
                      >
                        {t("Max DMs per hour")}
                      </label>
                      <input
                        id={`cap-${account.id}`}
                        type="number"
                        min={1}
                        max={750}
                        inputMode="numeric"
                        placeholder={String(data?.defaultHourlyDmCap ?? 750)}
                        value={
                          capDrafts[account.id] ?? String(account.hourlyDmCap ?? "")
                        }
                        onChange={(event) =>
                          setCapDrafts((drafts) => ({
                            ...drafts,
                            [account.id]: event.target.value,
                          }))
                        }
                        className="w-24 rounded border border-border bg-background px-2 py-1 text-sm text-foreground"
                      />
                      <button
                        onClick={() => saveHourlyCap(account.id)}
                        disabled={
                          capDrafts[account.id] === undefined ||
                          busy === `cap:${account.id}`
                        }
                        className="rounded border border-border px-3 py-1 text-xs font-medium text-foreground hover:bg-surface-hover disabled:opacity-50"
                      >
                        {busy === `cap:${account.id}` ? t("Saving…") : t("Save")}
                      </button>
                    </div>
                  )}
                </div>
                {canManageMembers && (
                  <button
                    onClick={() => disconnectInstagram(account.id)}
                    disabled={busy === `disconnect:${account.id}`}
                    className="inline-flex items-center justify-center rounded border border-error/20 px-4 py-2 text-sm font-medium text-error transition-all hover:border-error/40 hover:bg-error/10 disabled:opacity-50"
                  >
                    {busy === `disconnect:${account.id}`
                      ? t("Disconnecting...")
                      : t("Disconnect")}
                  </button>
                )}
              </div>
            ))}
            {accounts.length > 0 && (
              <p className="text-xs text-muted">
                {t("Leave empty to use the default of {count} per hour. Meta allows at most 750.", { count: data?.defaultHourlyDmCap ?? 750 })}
              </p>
            )}
            {capError && <p className="text-xs text-error">{capError}</p>}
          </div>
        </div>

        {canManageMembers && (
          <div className="mt-6 pt-4 border-t border-border flex gap-3">
            <a
              href="/api/instagram/connect"
              className="px-4 py-2 rounded text-sm font-medium transition-colors bg-accent text-white hover:bg-accent-hover"
            >
              {t("Connect using your own Meta app")}
            </a>
          </div>
        )}
      </section>

      <section className="panel rounded p-4 sm:p-6">
        <h2 className="text-base font-semibold mb-6">{t("Team")}</h2>
        <div className="space-y-3">
          {membersData?.members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {member.user.name ?? member.user.email ?? t("Unknown member")}
                </p>
                <p className="text-xs text-muted">{member.user.email}</p>
              </div>
              {canManageMembers &&
              member.role !== "OWNER" &&
              member.user.id !== membersData.currentUserId ? (
                <div className="flex shrink-0 items-center gap-2">
                  <select
                    aria-label={t("Role")}
                    value={member.role}
                    disabled={busy === `member:${member.id}`}
                    onChange={(event) =>
                      void updateMember(member.id, {
                        role: event.target.value as "ADMIN" | "MEMBER",
                      })
                    }
                    className="rounded border border-border bg-surface px-2 py-1 text-xs text-foreground disabled:opacity-50"
                  >
                    <option value="MEMBER">{t("Member")}</option>
                    <option value="ADMIN">{t("Admin")}</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => void updateMember(member.id, "remove")}
                    disabled={busy === `member:${member.id}`}
                    className="rounded-lg border border-error/20 px-3 py-1 text-xs font-medium text-error transition-colors hover:bg-error/10 disabled:opacity-50"
                  >
                    {t("Remove")}
                  </button>
                </div>
              ) : (
                <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted">
                  {label(member.role)}
                </span>
              )}
            </div>
          ))}
        </div>

        {canManageMembers && membersData?.invitations.length ? (
          <div className="mt-6 border-t border-border pt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {t("Pending invites")}
            </p>
            <div className="space-y-3">
              {membersData.invitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex flex-col gap-3 rounded border border-border bg-surface/70 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {invitation.email}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {label(invitation.role)} · {invitation.inviteUrl}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        void navigator.clipboard?.writeText(invitation.inviteUrl)
                      }
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-border-hover hover:text-foreground"
                    >
                      {t("Copy")}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeInvitation(invitation.id)}
                      disabled={busy === `invite:${invitation.id}`}
                      className="rounded-lg border border-error/20 px-3 py-1.5 text-xs font-medium text-error transition-colors hover:bg-error/10 disabled:opacity-50"
                    >
                      {t("Revoke")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {canManageMembers && (
          <form
            onSubmit={inviteMember}
            className="mt-6 grid gap-3 border-t border-border pt-4 sm:grid-cols-[1fr_140px_auto]"
          >
            <input
              type="email"
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              placeholder="teammate@agency.com"
              className="rounded border border-border bg-surface px-4 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent/40"
              required
            />
            <select
              value={inviteRole}
              onChange={(event) =>
                setInviteRole(event.target.value as "ADMIN" | "MEMBER")
              }
              className="rounded border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent/40"
            >
              <option value="MEMBER">{t("Member")}</option>
              <option value="ADMIN">{t("Admin")}</option>
            </select>
            <button
              type="submit"
              disabled={busy === "invite"}
              className="rounded bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
            >
              {busy === "invite" ? t("Inviting...") : t("Invite")}
            </button>
            {memberError && (
              <p className="sm:col-span-3 text-sm text-error">{memberError}</p>
            )}
          </form>
        )}
      </section>

      <section className="panel rounded p-4 sm:p-6">
        <h2 className="text-base font-semibold mb-6">{t("Usage")}</h2>
        <div className="flex items-center justify-between gap-3 py-3">
          <div>
            <p className="text-sm font-medium text-foreground">
              {t("DMs sent this month")}
            </p>
            <p className="text-xs text-muted mt-0.5">
              {t("Self-hosted — no plan limits.")}
            </p>
          </div>
          <span className="text-sm font-semibold text-foreground">
            {data?.workspace.dmsSentThisPeriod ?? 0}
          </span>
        </div>
      </section>
    </div>
  );
}
