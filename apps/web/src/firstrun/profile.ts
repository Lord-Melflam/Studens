/**
 * The first run's client side of `/api/profile`.
 *
 * One resource, patched a screen at a time. Each screen sends only the fields
 * it owns, so closing the browser on screen four leaves screens two and three
 * saved (FR-F5) and a stale tab cannot overwrite a newer edit with the values
 * it loaded ten minutes ago.
 */
export interface Profile {
  username: string | null;
  locale: string | null;
  institutionCode: string | null;
  studies: string | null;
  yearOfStudy: number | null;
  interests: string | null;
  onboarded: boolean;
  onboardingStep: number;
  emailDomain?: string;
  /** FR-A12. The provider's is identity and read-only; the contact one is not. */
  providerEmail?: string | null;
  contactEmail?: string | null;
  contactVerified?: boolean;
}

export interface Institution {
  code: string;
  name: string;
  city: string | null;
  colour: string | null;
  community: string | null;
  available: boolean;
}

/** The reasons a name can be refused, as the API names them. */
export type UsernameProblem = "short" | "long" | "shape" | "reserved" | "taken";

export class PatchFailed extends Error {
  constructor(
    readonly field: string,
    readonly reason?: UsernameProblem,
  ) {
    super(`profile: ${field}`);
    this.name = "PatchFailed";
  }
}

export async function fetchProfile(): Promise<Profile | null> {
  const r = await fetch("/api/profile");
  if (!r.ok) return null;
  return (await r.json()) as Profile;
}

export async function fetchInstitutions(): Promise<Institution[]> {
  const r = await fetch("/api/institutions");
  if (!r.ok) return [];
  const body = (await r.json()) as { institutions: Institution[] };
  return body.institutions;
}

export async function patchProfile(patch: Record<string, unknown>): Promise<Profile> {
  const r = await fetch("/api/profile", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (r.ok) return (await r.json()) as Profile;

  const body = (await r.json().catch(() => ({}))) as {
    error?: string;
    field?: string;
    reason?: UsernameProblem;
  };
  if (r.status === 409 && body.error === "username") {
    throw new PatchFailed("username", body.reason);
  }
  throw new PatchFailed(body.field ?? "unknown");
}
