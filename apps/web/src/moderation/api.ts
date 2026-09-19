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
