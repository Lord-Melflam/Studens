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
  /** 0 means the first run has never been opened. See Zone in main.tsx. */
  onboardingStep?: number;
  devSignInAvailable: boolean;
}

interface SessionValue {
  /** null while the first request is in flight. */
  session: SessionState | null;
  /**
   * Fetch it again, and RESOLVE WHEN THE STATE HAS BEEN SET.
   *
   * The promise is the whole point. Anything that changes what the session says
   * about itself, finishing the first run above all, has to be able to wait for
   * the new answer before it navigates. Without that, the next screen is
   * decided from the answer fetched on mount, which is the one that is no
   * longer true.
   */
  reload: () => Promise<void>;
}

const Ctx = createContext<SessionValue>({ session: null, reload: () => Promise.resolve() });

export function SessionProvider({
  children,
  initial = null,
}: {
  children: ReactNode;
  /**
   * A starting answer, so the signed-in tree can be rendered without a browser.
   *
   * The application never passes it: it starts at null and the fetch below
   * fills it in. It exists because every screen behind a session was
   * unreachable from a test, and the two worst bugs of 2026-09-13 were both on
   * exactly that path, found by François and not by 350 tests.
   */
  initial?: SessionState | null;
}) {
  const [session, setSession] = useState<SessionState | null>(initial);

  const reload = useCallback(async () => {
    try {
      const r = await fetch("/api/session");
      setSession(r.ok ? ((await r.json()) as SessionState) : null);
    } catch {
      setSession(null);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return <Ctx.Provider value={{ session, reload }}>{children}</Ctx.Provider>;
}

export function useSession(): SessionValue {
  return useContext(Ctx);
}
