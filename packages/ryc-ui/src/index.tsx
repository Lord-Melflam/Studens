/**
 * RYC's registration with the shell.
 *
 * FR-B18: the shell knows a module only through this. A name, a route, a short
 * description and a component. Adding a module changes the shell's registry and
 * nothing else, which is FR-B4 applied to the frontend.
 *
 * Nothing about courses or reviews leaves this package.
 */
import type { Bundle, Translate } from "@studens/i18n";
import { Ryc } from "./Ryc.js";
import { Showcase } from "./Showcase.js";
import { rycStrings } from "./strings.js";
import "./ryc.css";

export interface ModuleRegistration {
  /** Stable identifier, used in the route. */
  id: string;
  /** What a Member sees in the shell's navigation. */
  name: string;
  /** One line, shown on the shell's home screen. */
  summary: string;
  /**
   * Absent for a module that is announced but not built. The shell mounts and
   * navigates to live modules only; the public zone lists both, because "what
   * is coming" is something a stranger is entitled to see, and because naming
   * it here is the alternative to a roadmap page that drifts.
   */
  component?: () => JSX.Element;
  /** The module's own translations, merged into the bundle by the shell. */
  strings: Bundle;
  /**
   * How the module presents itself to someone who has no account.
   *
   * The public zone needs to explain what this module is for, and explaining
   * it means using words like "course" and "review". FR-B16 forbids those
   * words in the shell, and rightly: the day MPA ships, a landing page written
   * in RYC's vocabulary would be wrong rather than merely coupled.
   *
   * So the module says it, and apps/web renders whatever it is handed without
   * understanding any of it. The same reason the registry exists at all.
   */
  /**
   * Built from the translator rather than stored as text, so a module's public
   * copy is translated by the same mechanism as everything else. The shell
   * calls it with the active locale's translator.
   */
  presentation: (t: Translate) => ModulePresentation;
}

export interface ModulePresentation {
  /**
   * Whether this is usable today. The public site must never describe a plan
   * in the present tense: requirements.md 1.1 says a small app that genuinely
   * works beats a large one that does not, and the site should read that way.
   */
  status: "live" | "planned";
  /** What "live" or "planned" means for this module, in one line. */
  statusNote: string;
  /**
   * Everything below is present for a LIVE module and absent for a planned
   * one. A planned module gets a name, a line and a status, and nothing more:
   * writing a problem statement and a feature list for something unbuilt is
   * how a roadmap becomes a promise.
   */
  /** The problem it exists to solve, in the words of someone who has it. */
  problem?: { title: string; body: string[] };
  /** What it actually does, as steps rather than features. */
  steps?: Array<{ title: string; body: string }>;
  /**
   * Concrete promises, titled by what the reader gets rather than by what the
   * software has. "Nothing is asked that the catalogue already knows" rather
   * than "catalogue integration".
   */
  highlights?: Array<{ title: string; body: string }>;
  /** Where the module's own data comes from, named in plain words. */
  sources?: { title: string; body: string; items: string[] };
  /**
   * The last step of "getting started", which is the only one that is not the
   * platform's. Signing in and choosing a name are the same whatever module
   * you came for; what you do next is not.
   */
  firstAction?: { title: string; body: string };
  /**
   * A static mock of the module's own screen, owned by the module.
   *
   * The public zone places it and cannot read it. Built from the real
   * components, so it cannot drift into showing something the product does not
   * do.
   */
  showcase?: () => JSX.Element;
}

export const rycModule: ModuleRegistration = {
  id: "ryc",
  name: "Rate Your Courses",
  summary: "Ce que valent vraiment les cours, d'après les étudiants qui les ont suivis.",
  component: Ryc,
  strings: rycStrings,
  presentation: (t) => ({
    status: "live",
    statusNote: t("ryc.status.note"),
    problem: {
      title: t("ryc.problem.title"),
      body: [t("ryc.problem.1"), t("ryc.problem.2"), t("ryc.problem.3")],
    },
    steps: [1, 2, 3].map((n) => ({
      title: t(`ryc.step.${n}.title`),
      body: t(`ryc.step.${n}.body`),
    })),
    highlights: [1, 2, 3, 4].map((n) => ({
      title: t(`ryc.highlight.${n}.title`),
      body: t(`ryc.highlight.${n}.body`),
    })),
    sources: {
      title: t("ryc.sources.title"),
      body: t("ryc.sources.body"),
      items: [1, 2, 3, 4].map((n) => t(`ryc.sources.${n}`)),
    },
    firstAction: { title: t("ryc.first.title"), body: t("ryc.first.body") },
    showcase: Showcase,
  }),
};

export { Ryc };
export type { CourseDetail, CourseSummary } from "./api.js";

/**
 * The review path's state machine, exported because it is checked from
 * test/ui. It is the module's contract about one thing: an anonymous review is
 * only ever written from the confirmation step (FR-C9).
 */
export { next, EVENTS, STEPS, type Event, type Step, type Transition } from "./flow.js";

/**
 * The renderer for the catalogue's structured fields, and its model. Exported
 * for test/ui: the parser and the renderer are tested separately, and blocks
 * that arrive nested but render flat are the same bug to a reader.
 */
export { Blocks, ProseField, type Block, type Span } from "./Prose.js";

/**
 * The fork and its confirmation. Exported for test/ui/path-honesty.test.ts,
 * which holds the rule that the two cards may not advertise a capability that
 * is not built: this is the screen where a permanent choice is made by
 * comparing them.
 */
export { PathChoice, AnonymousConfirm } from "./PathChoice.js";
export { Steps, type StepName } from "./Steps.js";
export { rycStrings } from "./strings.js";
