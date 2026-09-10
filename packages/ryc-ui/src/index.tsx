/**
 * RYC's registration with the shell.
 *
 * FR-B18: the shell knows a module only through this. A name, a route, a short
 * description and a component. Adding a module changes the shell's registry and
 * nothing else, which is FR-B4 applied to the frontend.
 *
 * Nothing about courses or reviews leaves this package.
 */
import { Ryc } from "./Ryc.js";
import "./ryc.css";

export interface ModuleRegistration {
  /** Stable identifier, used in the route. */
  id: string;
  /** What a Member sees in the shell's navigation. */
  name: string;
  /** One line, shown on the shell's home screen. */
  summary: string;
  component: () => JSX.Element;
}

export const rycModule: ModuleRegistration = {
  id: "ryc",
  name: "Rate Your Courses",
  summary:
    "Ce que valent vraiment les cours, d'après les étudiants qui les ont suivis.",
  component: Ryc,
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
