/**
 * What the web app exposes for testing.
 *
 * Not an entry point: `main.tsx` is, and it has side effects. This exists so
 * test/ui can import the public zone BY NAME, like every other package. The
 * FR-B6 rule forbids relative imports across workspace boundaries, correctly.
 */
export { PublicZone } from "./public/index.js";
export { Landing } from "./public/Landing.js";
export { PublicLayout } from "./public/PublicLayout.js";
export { currentPath, isAppPath, moduleIdFrom, linkProps, APP_PREFIX } from "./router.js";
export { modules, liveModules, presentModules, activeModuleFor } from "./shell/registry.js";
export { bundle } from "./bundle.js";
export {
  FIRST_RUN,
  STEPS,
  FirstRun,
  firstRunPath,
  hasExplicitStep,
  isFirstRunPath,
  stepFrom,
} from "./firstrun/FirstRun.js";

/**
 * The screens behind a session, so they can be drawn in a test.
 *
 * Exported after 2026-09-13, when the app shipped broken twice on the
 * signed-in path while every test rendered either the public zone or a
 * component with no session. See test/ui/signed-in.test.ts.
 */
export { Shell, signOutDestination } from "./shell/Shell.js";
export { Settings } from "./Settings.js";
export { SessionProvider, useSession, type SessionState } from "./session.js";

/**
 * The browser's mirror of the server's text rules, exported so a test can run
 * both over one corpus and fail if they drift. See test/kernel/text.test.ts.
 */
export {
  TEXT_LIMITS,
  countGraphemes,
  textProblem,
  type TextProblem,
} from "./firstrun/text.js";
