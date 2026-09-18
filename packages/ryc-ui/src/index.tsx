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
import { CatalogueFacts } from "./CatalogueFacts.js";
import { rycStrings } from "./strings.js";
import "./ryc.css";

export interface ModuleRegistration {
  /** Stable identifier, used in the route. */
  id: string;
  /**
   * The module's product name, and the one field here that is NOT translated:
   * "Rate Your Courses" is a name, not a sentence, and translating a name is
   * how a product ends up being called three different things.
   */
  name: string;

  // NO `summary` FIELD, deliberately. Line comments, not a doc comment, so this
  // cannot be read as documenting the field below it.
  //
  // There was one, holding a French sentence, and the shell's home screen
  // printed it verbatim: an English page said "Ce que valent vraiment les
  // cours". Nothing caught it, because the gate that forbids hardcoded prose
  // looks at markup, and a sentence stored in a data field is not markup.
  //
  // The one line about a module comes from its own catalogue, under
  // `<id>.summary`, which every module already defines in all three languages.
  // Removing the field removes the place an untranslated sentence could sit,
  // which is worth more than a check that finds it afterwards.

  /**
   * Absent for a module that is announced but not built. The shell mounts and
   * navigates to live modules only; the public zone lists both, because "what
   * is coming" is something a stranger is entitled to see, and because naming
   * it here is the alternative to a roadmap page that drifts.
   */
  component?: (props: ModuleProps) => JSX.Element;
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

/**
 * What the shell hands a module so the module can own its own URLs.
 *
 * Everything below `/app/<id>` belongs to the module. The shell slices its own
 * prefix off and passes the rest; it never parses it, so it still does not
 * know what a course is (FR-B16).
 *
 * This exists because RYC held its whole position in component state: the
 * browser Back button left the app instead of going back a screen, a course
 * could not be linked to anyone, and a refresh lost your place. Navigation that
 * does not touch the URL is not navigation, it is a wizard.
 */
export interface ModuleProps {
  /** The path inside the module. "/" at its root, "/c/lepl1503" deeper. */
  path: string;
  /**
   * The query string, `?` and all, or "" when there is none.
   *
   * WHERE A SCREEN'S OWN SETTINGS LIVE: which filters are on, what is typed in
   * a search box. They are part of what you are looking at, so Back has to
   * restore them, a refresh has to keep them, and a link has to carry them to
   * somebody else. Held in component state instead, all three fail, and the
   * third fails silently: the link works and shows a different screen.
   *
   * The shell hands this over without reading it, exactly as it does the path.
   * The names of the parameters are the module's vocabulary (FR-B16).
   *
   * NOT for anything unpublished, above all the text of a review being written.
   * A URL is read by browser history, by bookmark sync and by anyone looking
   * over a shoulder, and FR-C9 cannot reach any of them.
   */
  search: string;
  /**
   * Go somewhere inside this module. Takes a module-relative path, which may
   * carry a query string.
   *
   * `replace` for a change of settings, the default push for a change of
   * screen. Six filter chips must not be six history entries, or Back walks
   * back through your own filtering instead of leaving the screen.
   */
  navigate: (to: string, opts?: { replace?: boolean }) => void;
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
  /**
   * Where the module's data comes from. `facts` is a component rather than a
   * list of strings because the answer contains numbers, and a number written
   * into a translated string is stale the moment the crawler runs again. The
   * shell places it and does not read it (FR-B16).
   */
  sources?: { title: string; body: string; facts: () => JSX.Element | null };
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
      facts: CatalogueFacts,
    },
    firstAction: { title: t("ryc.first.title"), body: t("ryc.first.body") },
    showcase: Showcase,
  }),
};

export { Ryc, parseView, type RycView } from "./Ryc.js";
/**
 * The course page's folded sections, as they travel in the address. Pure, so
 * the round trip is checked directly in test/ui/url-state.test.ts.
 */
export {
  OPEN_KEY,
  openSectionsFrom,
  openSectionsQuery,
  toggleSection,
} from "./Ryc.js";
/** Which page of a course's reviews is on screen, as it travels in the URL. */
export { PAGE_KEY, reviewPageFrom, reviewPageQuery } from "./Ryc.js";
export type { CourseDetail, CourseSummary, ProgrammeSummary } from "./api.js";

/**
 * Filtering, exported because it is pure and therefore checked directly.
 * The properties that matter are about the facet counts agreeing with the
 * list, which is far easier to hold here than through a rendered screen.
 */
export {
  NO_COURSE_FILTER,
  NO_PROGRAMME_FILTER,
  applyCourseFilter,
  applyProgrammeFilter,
  courseFacets,
  courseFilterIsEmpty,
  programmeFacets,
  programmeFilterIsEmpty,
  groupByKind,
  groupByTerm,
  GROUP_COURSES_ABOVE,
  titleWithoutSite,
  toggle,
  type CourseFacets,
  type CourseFilter,
  type Facet,
  type ProgrammeFacets,
  type ProgrammeFilter,
} from "./filters.js";

/**
 * A screen's settings, read out of the URL and written back into it. Exported
 * because test/ui checks the whole round trip without a browser: a filter that
 * encodes and decodes to something else is a link that shows the wrong list.
 */
export {
  COURSE_FILTER_KEYS,
  PROGRAMME_FILTER_KEYS,
  UNSTATED,
  courseFilterFromQuery,
  courseFilterToQuery,
  programmeFilterFromQuery,
  programmeFilterToQuery,
  pruneCourseFilter,
  pruneProgrammeFilter,
} from "./filters.js";
export { queryOf, replaceKeys, settingsRoute, withQuery } from "./urlstate.js";

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
export {
  Blocks,
  ProseField,
  FoldedField,
  CatalogueLanguageNote,
  CATALOGUE_LANG,
  type Block,
  type Span,
} from "./Prose.js";

/**
 * The fork and its confirmation. Exported for test/ui/path-claims.test.ts,
 * which holds the rule that the two cards may not advertise a capability that
 * is not built: this is the screen where a permanent choice is made by
 * comparing them.
 */
export { PathChoice, AnonymousConfirm } from "./PathChoice.js";
export { Steps, type StepName } from "./Steps.js";
export { rycStrings } from "./strings.js";

/** FR-E8: the notice form, exported so it can be rendered in a test. */
export { ReportForm } from "./ReportForm.js";
export { REPORT_CATEGORIES, REPORT_DETAIL_MIN, type ReportCategory } from "./api.js";

/** The filter bar over a list of courses. Exported so it can be rendered in a test. */
export { CourseFilters } from "./CourseFilters.js";
/** The review list and its pager, exported so the pager is checked directly. */
export { Reviews } from "./Reviews.js";
/**
 * The filter panel's two pieces, exported for test/ui/filter-panel.test.ts.
 *
 * Both are pure: given the options and what is chosen they render the same
 * thing every time, so they are checked directly rather than through a browse
 * screen that would have to be given a catalogue, a session and a router first.
 */
export { FilterGroup, ScopePicker } from "./Filters.js";
export { CourseList } from "./CourseList.js";
