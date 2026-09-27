/**
 * The console's client side. FR-E10 to FR-E14.
 *
 * A 404 from any of these means "you do not have this power", not "the server
 * is broken": the API answers 404 rather than 403 so that somebody without the
 * role cannot confirm the console exists. So an error here is a normal state to
 * render, not a failure to report.
 */
export interface ModeratedTarget {
  targetId: string;
  path: string;
  author: string | null;
  body: string;
  advice: string | null;
  /**
   * Where the contribution lives, as something a person can read.
   *
   * A label and never the module's own identifier. The console is in the
   * shell's zone, which may not name what a module owns (FR-B16), and it has no
   * use for an id it could not resolve anyway: the API turns the module's id
   * into this before it leaves.
   */
  context: string | null;
  held: boolean;
}

export interface QueueEntry {
  targetKind: string;
  targetId: string;
  open: number;
  fromMembers: number;
  oldestAt: string;
  categories: string[];
  target: ModeratedTarget | null;
}

export interface Appointment {
  memberId: string;
  username: string | null;
  role: string;
}

export interface AppointmentEvent {
  at: string;
  actorMemberId: string;
  targetId: string;
  action: string;
}

export interface Powers {
  canModerate: boolean;
  canAppoint: boolean;
}

export async function fetchPowers(): Promise<Powers> {
  const r = await fetch("/api/moderation/whoami");
  if (!r.ok) return { canModerate: false, canAppoint: false };
  return (await r.json()) as Powers;
}

export async function fetchQueue(): Promise<QueueEntry[]> {
  const r = await fetch("/api/moderation/queue");
  if (!r.ok) return [];
  const body = (await r.json()) as { queue: QueueEntry[] };
  return body.queue;
}

export async function decide(input: {
  targetKind: string;
  targetId: string;
  action: "hold" | "release" | "leave";
  outcome: "upheld" | "rejected";
  reason: string;
}): Promise<void> {
  const r = await fetch("/api/moderation/decide", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!r.ok) throw new Error("decide");
}

export async function fetchAppointments(): Promise<{
  roles: string[];
  appointments: Appointment[];
  history: AppointmentEvent[];
}> {
  const r = await fetch("/api/moderation/appointments");
  if (!r.ok) return { roles: [], appointments: [], history: [] };
  return (await r.json()) as {
    roles: string[];
    appointments: Appointment[];
    history: AppointmentEvent[];
  };
}

export async function appoint(username: string, role: string): Promise<void> {
  const r = await fetch("/api/moderation/appointments", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, role }),
  });
  if (!r.ok) {
    const body = (await r.json().catch(() => ({}))) as { reason?: string };
    throw new Error(body.reason ?? "failed");
  }
}

export interface SettingRow {
  key: string;
  min: number;
  max: number;
  fallback: number;
  /** Null when nobody has set it, so the screen can show the default as one. */
  value: string | null;
  /**
   * What the setting does, in each language, served by the API.
   *
   * Not translated in the shell: these sentences describe a module's domain
   * and the shell may not carry those words (FR-B16). Optional because a
   * setting added without one should still render, showing its key and its
   * range as before rather than crashing the panel.
   */
  help?: Record<string, string>;
}

export async function fetchSettings(): Promise<SettingRow[]> {
  const r = await fetch("/api/moderation/settings");
  if (!r.ok) return [];
  return ((await r.json()) as { settings: SettingRow[] }).settings;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const r = await fetch("/api/moderation/settings", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key, value }),
  });
  if (!r.ok) {
    const body = (await r.json().catch(() => ({}))) as { min?: number; max?: number };
    throw new Error(body.min === undefined ? "failed" : `range:${body.min}:${body.max}`);
  }
}

/** `days: null` is permanent. `lift: true` ends a suspension early. */
export async function suspend(input: {
  username: string;
  days: number | null;
  reason: string;
  lift?: boolean;
}): Promise<{ notified: boolean }> {
  const r = await fetch("/api/moderation/suspend", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!r.ok) throw new Error(r.status === 409 ? "refused" : "failed");
  // Whether a message actually went out. The screen says which of the two
  // happened rather than claiming the person was told either way.
  return (await r.json()) as { notified: boolean };
}

export interface SuspendedAccount {
  username: string | null;
  since: string;
  /** Null is permanent, here as everywhere else. */
  until: string | null;
  reason: string | null;
  /** The administrator who decided, from the audit log. Null if it predates it. */
  by: string | null;
  /** Whether a confirmed address existed to write to when it was decided. */
  reachable: boolean;
}

export async function fetchSuspensions(
  q: string,
  page: number,
): Promise<{ suspensions: SuspendedAccount[]; page: number; pages: number; total: number }> {
  const params = new URLSearchParams();
  if (q !== "") params.set("q", q);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  const r = await fetch(`/api/moderation/suspensions${query === "" ? "" : `?${query}`}`);
  if (!r.ok) return { suspensions: [], page: 1, pages: 1, total: 0 };
  return (await r.json()) as {
    suspensions: SuspendedAccount[];
    page: number;
    pages: number;
    total: number;
  };
}

/** One row of the directory. Carries a domain; never an address (FR-A10). */
export interface DirectoryMember {
  id: string;
  username: string | null;
  role: string;
  emailDomain: string;
  createdAt: string;
  suspended: boolean;
  hasAddress: boolean;
}

export async function fetchMembers(
  q: string,
  role: string,
  page: number,
): Promise<{
  members: DirectoryMember[];
  roles: string[];
  page: number;
  pages: number;
  total: number;
}> {
  const params = new URLSearchParams();
  if (q !== "") params.set("q", q);
  if (role !== "") params.set("role", role);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  const r = await fetch(`/api/moderation/members${query === "" ? "" : `?${query}`}`);
  if (!r.ok) return { members: [], roles: [], page: 1, pages: 1, total: 0 };
  return (await r.json()) as {
    members: DirectoryMember[];
    roles: string[];
    page: number;
    pages: number;
    total: number;
  };
}

/**
 * One member's address. A separate call on purpose: the server writes an audit
 * row for it, so it must not happen as a side effect of drawing a list.
 */
export async function fetchAddress(
  id: string,
): Promise<{ providerEmail: string | null; contactEmail: string | null; contactVerified: boolean } | null> {
  const r = await fetch(`/api/moderation/members/${encodeURIComponent(id)}/address`);
  if (!r.ok) return null;
  return (await r.json()) as {
    providerEmail: string | null;
    contactEmail: string | null;
    contactVerified: boolean;
  };
}

/**
 * FR-E19: carry out an erasure the member cannot carry out themselves.
 *
 * DELETE, because that is what it is. The refusal reasons come back as a code
 * so the screen can say which of the two states it hit rather than "failed".
 */
export async function eraseMember(id: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const r = await fetch(`/api/moderation/members/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (r.ok) return { ok: true };
  const body = (await r.json().catch(() => ({}))) as { error?: string };
  return { ok: false, reason: body.error ?? "failed" };
}

/** FR-I3. One piece of feedback as the console sees it. */
export interface FeedbackItem {
  id: string;
  memberId: string | null;
  /** The sender's username, or null when nobody was signed in. */
  username: string | null;
  kind: string;
  message: string;
  /**
   * WHETHER an address was left, never the address. Knowing an answer is
   * possible is what a reader needs here; reading the address is a different
   * act with a different cost, the same split as the member directory.
   */
  hasEmail: boolean;
  route: string | null;
  locale: string | null;
  createdAt: string;
  status: string;
}

export interface FeedbackPageData {
  items: FeedbackItem[];
  total: number;
  counts: { open: number; read: number; done: number };
  kinds: string[];
  statuses: string[];
  perPage: number;
}

const EMPTY_FEEDBACK: FeedbackPageData = {
  items: [],
  total: 0,
  counts: { open: 0, read: 0, done: 0 },
  kinds: [],
  statuses: [],
  perPage: 25,
};

export async function fetchFeedback(
  q: string,
  kind: string,
  status: string,
  author: string,
  page: number,
): Promise<FeedbackPageData> {
  const params = new URLSearchParams();
  if (q !== "") params.set("q", q);
  if (kind !== "") params.set("kind", kind);
  if (status !== "") params.set("status", status);
  if (author !== "") params.set("author", author);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  const r = await fetch(`/api/moderation/feedback${query === "" ? "" : `?${query}`}`);
  if (!r.ok) return EMPTY_FEEDBACK;
  return (await r.json()) as FeedbackPageData;
}

export async function fetchFeedbackAuthors(): Promise<
  Array<{ memberId: string | null; username: string | null; count: number }>
> {
  const r = await fetch("/api/moderation/feedback/authors");
  if (!r.ok) return [];
  return ((await r.json()) as { authors: Array<{ memberId: string | null; username: string | null; count: number }> })
    .authors;
}

export async function setFeedbackState(id: string, status: string): Promise<boolean> {
  const r = await fetch(`/api/moderation/feedback/${encodeURIComponent(id)}/status`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status }),
  });
  return r.ok;
}

/**
 * FR-I4: the full export, which is a POST because it is audited and needs a
 * typed confirmation. The anonymised one is an ordinary download link and
 * needs no function here.
 *
 * Returns the parsed file so the caller can turn it into a download; a failure
 * returns null and the screen says which kind it was.
 */
export async function exportFeedbackFull(
  confirm: string,
): Promise<{ ok: true; file: unknown } | { ok: false; reason: "confirm" | "failed" }> {
  const r = await fetch("/api/moderation/feedback/export", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ confirm }),
  });
  if (r.ok) return { ok: true, file: await r.json() };
  return { ok: false, reason: r.status === 400 ? "confirm" : "failed" };
}
