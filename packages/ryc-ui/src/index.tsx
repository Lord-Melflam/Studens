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
  presentation: ModulePresentation;
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
  /** The problem it exists to solve, in the words of someone who has it. */
  problem: { title: string; body: string[] };
  /** What it actually does, as steps rather than features. */
  steps: Array<{ title: string; body: string }>;
}

export const rycModule: ModuleRegistration = {
  id: "ryc",
  name: "Rate Your Courses",
  summary:
    "Ce que valent vraiment les cours, d'après les étudiants qui les ont suivis.",
  component: Ryc,
  presentation: {
    status: "live",
    statusNote:
      "Utilisable aujourd'hui, avec les 546 cours accessibles depuis les programmes de l'EPL.",
    problem: {
      title: "Choisir un cours à l'aveugle",
      body: [
        "Au moment du PAE, vous choisissez des cours à option sur la base d'une fiche officielle. Elle dit ce que le cours contient. Elle ne dit pas ce qu'il demande vraiment, comment il est donné, ni à quoi ressemble l'examen.",
        "Le reste se passe sur Discord, en septembre, et se perd en trois semaines. Chaque année, la même question est reposée aux mêmes personnes, et la réponse disparaît à nouveau.",
        "Studens garde ces réponses au même endroit, datées, avec la charge de travail réelle et l'année où le cours a été suivi.",
      ],
    },
    steps: [
      {
        title: "Cherchez ou parcourez",
        body: "Par code, par mot du titre, ou en parcourant un programme entier. Le catalogue vient directement de l'université: ECTS, quadrimestre, langue, heures encadrées et mode d'évaluation officiel.",
      },
      {
        title: "Lisez ce que disent celles et ceux qui l'ont suivi",
        body: "Une note de recommandation, la charge de travail rapportée à ses crédits, la difficulté, et surtout du texte: ce qui aide, ce qui manque, et ce qu'il faut savoir avant de s'inscrire.",
      },
      {
        title: "Donnez le vôtre, sous votre nom ou anonymement",
        body: "Le choix se fait sur un écran à lui seul, après avoir écrit. L'anonymat est définitif et sans lien avec votre compte: c'est une garantie de structure, pas une promesse.",
      },
    ],
  },
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
