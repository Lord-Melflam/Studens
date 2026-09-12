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
import type { Bundle, Translate } from "@studens/i18n";
import { moduleIdFrom } from "../router.js";

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
const mpaStrings: Bundle = {
  fr: {
    "mpa.summary": "De l'aide pour organiser son année et son travail.",
    "mpa.status.note":
      "Pas encore commencé. Annoncé ici parce que c'est le prochain besoin observé, pas parce qu'une date existe.",
  },
  nl: {
    "mpa.summary": "Hulp om je jaar en je werk te organiseren.",
    "mpa.status.note":
      "Nog niet begonnen. Hier vermeld omdat het de volgende vastgestelde nood is, niet omdat er een datum bestaat.",
  },
  en: {
    "mpa.summary": "Help organising your year and your work.",
    "mpa.status.note":
      "Not started. Listed here because it is the next observed need, not because a date exists.",
  },
};

const plannedMpa: ModuleRegistration = {
  id: "mpa",
  name: "My Planning Advisor",
  summary: "De l'aide pour organiser son année et son travail.",
  strings: mpaStrings,
  presentation: (t) => ({
    status: "planned",
    statusNote: t("mpa.status.note"),
  }),
};

/** Everything the platform offers or has announced, in order of readiness. */
export const modules: ModuleRegistration[] = [rycModule, plannedMpa];

/** What the shell can actually mount and navigate to. */
export const liveModules = modules.filter(
  (m): m is ModuleRegistration & { component: () => JSX.Element } => m.component !== undefined,
);

/**
 * A module plus its presentation resolved in the active language.
 *
 * The public zone works on these, so no page has to know that a presentation
 * is a function of the translator.
 */
export interface PresentedModule {
  id: string;
  name: string;
  summary: string;
  presentation: ModulePresentation;
}

/**
 * Which module a path mounts, or null for the app's own home screen.
 *
 * Pulled out of `Shell` so it can be tested. It is one expression, and one
 * expression is exactly where the locale-prefix bug lived: the Shell handed it
 * `window.location.pathname`, which carries the language, and it silently
 * resolved to nothing. A dead button is not a crash, so nothing reported it.
 *
 * Takes either form of path: `/fr/app/ryc` or `/app/ryc`.
 */
export function activeModuleFor(path: string): ModuleRegistration | null {
  const id = moduleIdFrom(path);
  return id === null ? null : (liveModules.find((m) => m.id === id) ?? null);
}

export function presentModules(t: Translate): PresentedModule[] {
  return modules.map((m) => ({
    id: m.id,
    name: m.name,
    summary: t(`${m.id}.summary`),
    presentation: m.presentation(t),
  }));
}

export type { ModuleRegistration, ModulePresentation };
