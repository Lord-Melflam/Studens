/**
 * The module registry.
 *
 * FR-B18: this is the ONLY place the shell learns that a module exists.
 * Adding MPA means adding one line here and nothing else, which is FR-B4
 * applied to the frontend.
 *
 * FR-B14: modules are imported, not loaded at runtime. There is no plugin
 * mechanism, because all module code lives in this repository and is reviewed
 * before merge.
 *
 * FR-B1 says a Member sees only the modules they are entitled to use. That
 * filtering is not here yet, because authentication is not built: see 3.2.
 */
import { rycModule, type ModuleRegistration, type ModulePresentation } from "@studens/ryc-ui";

/**
 * Announced, not built.
 *
 * It has a name, a line and a status, and deliberately nothing else. Writing a
 * problem statement or a feature list for something unbuilt is how a roadmap
 * turns into a promise, and `CLAUDE.md` is explicit that this one has no shape
 * yet and must not be given one in passing.
 *
 * It lives here rather than in a package because there is no package: the
 * registry is where the shell learns a module exists, and "exists" includes
 * "is coming".
 */
const plannedMpa: ModuleRegistration = {
  id: "mpa",
  name: "My Planning Advisor",
  summary: "De l'aide pour organiser son année et son travail.",
  presentation: {
    status: "planned",
    statusNote:
      "Pas encore commencé. Annoncé ici parce que c'est le prochain besoin observé, pas parce qu'une date existe.",
  },
};

/** Everything the platform offers or has announced, in order of readiness. */
export const modules: ModuleRegistration[] = [rycModule, plannedMpa];

/** What the shell can actually mount and navigate to. */
export const liveModules = modules.filter(
  (m): m is ModuleRegistration & { component: () => JSX.Element } => m.component !== undefined,
);

export type { ModuleRegistration, ModulePresentation };
