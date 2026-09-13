/**
 * The account panel's client side: the address, what may be sent to it, and
 * leaving.
 *
 * Separate from `firstrun/profile.ts` because these are a different kind of
 * operation. A profile field is saved as you type it and can be emptied again;
 * an address change is a request that completes somewhere else, and a deletion
 * cannot be taken back.
 */
export interface NotificationPreference {
  kind: string;
  enabled: boolean;
  decidedAt: string;
}

/**
 * Whether this installation can actually deliver mail.
 *
 * Carried through every one of these calls, because a screen that promises a
 * message which cannot leave the outbox is worse than one that says nothing.
 */
export interface Deliverability {
  deliverable: boolean;
}

export interface DeletionReport {
  memberId: string;
  modules: Record<string, number>;
  sessionsRevoked: number;
}

export type EmailProblem = "shape" | "long" | "same" | "other";

export class EmailRejected extends Error {
  constructor(readonly reason: EmailProblem) {
    super(`email: ${reason}`);
    this.name = "EmailRejected";
  }
}

export async function fetchNotifications(): Promise<{
  preferences: NotificationPreference[];
  deliverable: boolean;
}> {
  const r = await fetch("/api/notifications");
  if (!r.ok) return { preferences: [], deliverable: false };
  return (await r.json()) as { preferences: NotificationPreference[]; deliverable: boolean };
}

export async function setNotification(kind: string, enabled: boolean): Promise<void> {
  const r = await fetch("/api/notifications", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind, enabled }),
  });
  if (!r.ok) throw new Error("notification");
}

/**
 * Ask to be reached somewhere else.
 *
 * Resolves when the request is accepted, which is NOT when the address has
 * changed: that happens when the link in the message is opened. The screen says
 * so rather than showing a saved state that is not yet true.
 */
export async function requestEmailChange(email: string): Promise<Deliverability> {
  const r = await fetch("/api/account/email", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (r.status === 202) {
    const ok = (await r.json()) as Deliverability;
    return { deliverable: ok.deliverable };
  }
  const body = (await r.json().catch(() => ({}))) as { error?: string; reason?: EmailProblem };
  throw new EmailRejected(body.error === "email" ? (body.reason ?? "other") : "other");
}

/**
 * Download everything held, as a file.
 *
 * Fetched and turned into a blob rather than linked directly, because the
 * export needs the session cookie and a plain link would work but would also
 * navigate away from the panel on any failure, showing a JSON error page.
 */
export async function downloadExport(): Promise<void> {
  const r = await fetch("/api/account/export");
  if (!r.ok) throw new Error("export");
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "studens-export.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Irreversible. The caller has already asked twice by the time this runs. */
export async function deleteAccount(confirm: string): Promise<DeletionReport> {
  const r = await fetch("/api/account", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ confirm }),
  });
  if (!r.ok) throw new Error("delete");
  return (await r.json()) as DeletionReport;
}
