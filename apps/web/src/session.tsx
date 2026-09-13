/**
 * Who is signed in, fetched once and shared.
 *
 * Before this, three components each called `/api/session` on mount: the
 * account control in whichever header was showing, the settings panel, and now
 * the first run. Three requests for one answer, and three copies of the logic
 * that decides what "not signed in yet" looks like while the request is open.
 *
 * `null` means the answer has not arrived. That distinction matters: an
 * un-onboarded member is redirected to the first run, and treating "unknown"
 * as "not onboarded" would bounce a signed-out visitor into a setup wizard.
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export interface SessionState {
  signedIn: boolean;
  emailDomain?: string;
  role?: string;
  /** FR-F6. Null until the first run has been completed. */
  username?: string | null;
  onboarded?: boolean;
  devSignInAvailable: boolean;
}

interface SessionValue {
  /** null while the first request is in flight. */
  session: SessionState | null;
  reload: () => void;
}

const Ctx = createContext<SessionValue>({ session: null, reload: () => {} });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState | null>(null);

  const reload = useCallback(() => {
    fetch("/api/session")
      .then((r) => (r.ok ? (r.json() as Promise<SessionState>) : null))
      .then(setSession)
      .catch(() => setSession(null));
  }, []);

  useEffect(reload, [reload]);

  return <Ctx.Provider value={{ session, reload }}>{children}</Ctx.Provider>;
}

export function useSession(): SessionValue {
  return useContext(Ctx);
}
