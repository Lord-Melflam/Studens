/**
 * Filtering the catalogue.
 *
 * The properties worth holding are the ones that make a filter trustworthy
 * rather than the ones that make it work: a facet count that disagrees with the
 * list beneath it, or an option offered that matches nothing, is worse than no
 * filter at all, because it is read as the catalogue being wrong.
 */
import { describe, expect, it } from "vitest";
import {
  NO_COURSE_FILTER,
  NO_PROGRAMME_FILTER,
  applyCourseFilter,
  applyProgrammeFilter,
  courseFacets,
  courseFilterIsEmpty,
  programmeFacets,
  toggle,
} from "@studens/ryc-ui";
import type { CourseSummary, ProgrammeSummary } from "@studens/ryc-ui";
import { CourseFilters, rycStrings } from "@studens/ryc-ui";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nProvider } from "@studens/i18n";
import { DEFAULT_LOCALE, LOCALES, createTranslator } from "@studens/i18n";

const course = (over: Partial<CourseSummary>): CourseSummary => ({
  code: "lepl1000",
  title: "Un cours",
  year: 2025,
  ects: 5,
  quarter: "Q1",
  teachers: ["Quelqu'un"],
  external: false,
  mainLanguage: "Français",
  owningEntity: "EPL",
  ...over,
});

/** Shaped like the real thing: mixed quarters, languages, credits and entities. */
const catalogue: CourseSummary[] = [
  course({ code: "lepl1503", title: "Projet 3", quarter: "Q2", owningEntity: "BTCI" }),
  course({ code: "lepl1401", title: "Informatique", ects: 4, mainLanguage: "Anglais" }),
  course({ code: "linfo2145", title: "Cloud", ects: 5, mainLanguage: "Anglais", owningEntity: "INFO" }),
  course({ code: "lphy2360", title: "Physique", ects: 3, quarter: "Q2", owningEntity: "PHYS" }),
  course({ code: "lelec2990", title: "Mémoire", ects: 25, quarter: null, mainLanguage: null }),
];

const counts = { lepl1503: 1, linfo2145: 2 };

describe("filtering courses", () => {
  it("with nothing chosen, changes nothing", () => {
    expect(applyCourseFilter(catalogue, NO_COURSE_FILTER, counts)).toHaveLength(catalogue.length);
    expect(courseFilterIsEmpty(NO_COURSE_FILTER)).toBe(true);
  });

  it("matches a code or a word of the title, either case", () => {
    const by = (text: string) =>
      applyCourseFilter(catalogue, { ...NO_COURSE_FILTER, text }, counts).map((c) => c.code);
    expect(by("LEPL15")).toEqual(["lepl1503"]);
    expect(by("physique")).toEqual(["lphy2360"]);
    expect(by("cloud")).toEqual(["linfo2145"]);
  });

  /**
   * The lecturer is deliberately not searched. Section 5.1: a review naming a
   * lecturer already processes a third party's personal data, and a filter that
   * gathers a person's courses in one press is a different feature with a
   * different legal footing. If this ever passes, that decision was reversed by
   * accident.
   */
  it("does not match on a lecturer's name", () => {
    const hit = applyCourseFilter(
      catalogue,
      { ...NO_COURSE_FILTER, text: "quelqu'un" },
      counts,
    );
    expect(hit).toHaveLength(0);
  });

  it("combines dimensions as AND", () => {
    const out = applyCourseFilter(
      catalogue,
      { ...NO_COURSE_FILTER, quarters: ["Q1"], languages: ["Anglais"] },
      counts,
    );
    expect(out.map((c) => c.code)).toEqual(["lepl1401", "linfo2145"]);
  });

  it("treats several values in one dimension as OR", () => {
    const out = applyCourseFilter(catalogue, { ...NO_COURSE_FILTER, ects: [3, 4] }, counts);
    expect(out.map((c) => c.code).sort()).toEqual(["lepl1401", "lphy2360"]);
  });

  /**
   * A course with no quarter is not secretly in every quarter. Archived years
   * legitimately lack the field, and a null that matches everything would put
   * courses into a filter the catalogue never claimed them for.
   */
  it("excludes a course whose value is missing, rather than matching it", () => {
    const q = applyCourseFilter(catalogue, { ...NO_COURSE_FILTER, quarters: ["Q1"] }, counts);
    expect(q.map((c) => c.code)).not.toContain("lelec2990");
    const l = applyCourseFilter(catalogue, { ...NO_COURSE_FILTER, languages: ["Français"] }, counts);
    expect(l.map((c) => c.code)).not.toContain("lelec2990");
  });

  it("can narrow to what there is something to read about", () => {
    const out = applyCourseFilter(catalogue, { ...NO_COURSE_FILTER, reviewedOnly: true }, counts);
    expect(out.map((c) => c.code).sort()).toEqual(["lepl1503", "linfo2145"]);
  });
});

describe("the facets are the data, not a list somebody wrote", () => {
  it("offers only values that are present", () => {
    const f = courseFacets(catalogue, NO_COURSE_FILTER, counts);
    expect(f.quarters.map((x) => x.value)).toEqual(["Q1", "Q2"]);
    expect(f.languages.map((x) => x.value)).toEqual(["Anglais", "Français"]);
    expect(f.ects.map((x) => x.value)).toEqual([3, 4, 5, 25]);
    expect(f.entities.map((x) => x.value)).toEqual(["BTCI", "EPL", "INFO", "PHYS"]);
  });

  it("never offers an option for a value nothing has", () => {
    const onlyQ1 = catalogue.filter((c) => c.quarter === "Q1");
    const f = courseFacets(onlyQ1, NO_COURSE_FILTER, counts);
    expect(f.quarters.map((x) => x.value)).toEqual(["Q1"]);
  });

  /**
   * The property the whole facet design exists for. A count is what you get if
   * you click it, so it is computed with its own dimension ignored and every
   * other one applied. Counting against the unfiltered list instead would show
   * "Q1 (3)" next to a list that empties when pressed.
   */
  it("counts each facet against the OTHER filters", () => {
    const f = courseFacets(catalogue, { ...NO_COURSE_FILTER, languages: ["Anglais"] }, counts);
    // Two English courses, one in each quarter... and in this fixture both are Q1.
    const q1 = f.quarters.find((x) => x.value === "Q1");
    expect(q1?.count).toBe(2);
    expect(f.quarters.find((x) => x.value === "Q2")).toBeUndefined();

    // The language facet itself still shows every language, because its own
    // dimension is the one being ignored. Otherwise choosing a language would
    // hide every other language and there would be no way back.
    expect(f.languages.map((x) => x.value)).toEqual(["Anglais", "Français"]);
  });

  it("a facet count always equals what selecting it returns", () => {
    const base = { ...NO_COURSE_FILTER, quarters: ["Q1"] };
    const f = courseFacets(catalogue, base, counts);
    for (const lang of f.languages) {
      const got = applyCourseFilter(catalogue, { ...base, languages: [lang.value] }, counts);
      expect(got.length, `language ${lang.value}`).toBe(lang.count);
    }
    for (const e of f.ects) {
      const got = applyCourseFilter(catalogue, { ...base, ects: [e.value] }, counts);
      expect(got.length, `ects ${e.value}`).toBe(e.count);
    }
  });

  it("says how many of the matching courses have anything to read", () => {
    expect(courseFacets(catalogue, NO_COURSE_FILTER, counts).reviewed).toBe(2);
    expect(courseFacets(catalogue, { ...NO_COURSE_FILTER, quarters: ["Q2"] }, counts).reviewed).toBe(1);
  });
});

const programme = (over: Partial<ProgrammeSummary>): ProgrammeSummary => ({
  code: "sinf1ba",
  title: "Bachelier en sciences informatiques (Louvain-la-Neuve)",
  faculty: "epl",
  courses: 40,
  kind: "bachelier",
  credits: null,
  site: "Louvain-la-Neuve",
  ...over,
});

const programmes: ProgrammeSummary[] = [
  programme({}),
  programme({ code: "sinc1ba", site: "Charleroi" }),
  programme({ code: "info2m", kind: "master", credits: 120, title: "Master [120] : ingénieur civil en informatique (Louvain-la-Neuve)" }),
  programme({ code: "sinf2m1", kind: "master", credits: 60, title: "Master [60] en sciences informatiques (Louvain-la-Neuve)" }),
  programme({ code: "minsinf", kind: "mineure", title: "Mineure en sciences informatiques (Louvain-la-Neuve)" }),
  programme({ code: "filinfo", kind: "filiere", title: "Filière en Informatique (Louvain-la-Neuve)" }),
  programme({ code: "weird", kind: null, title: "Quelque chose de neuf (Autre site)", site: "Autre site" }),
];

describe("filtering programmes", () => {
  it("groups by the kind parsed from the title", () => {
    const of = (k: string | null) =>
      applyProgrammeFilter(programmes, { ...NO_PROGRAMME_FILTER, kinds: [k] }).map((p) => p.code);
    expect(of("bachelier")).toEqual(["sinf1ba", "sinc1ba"]);
    expect(of("master")).toEqual(["info2m", "sinf2m1"]);
    expect(of("mineure")).toEqual(["minsinf"]);
    expect(of("filiere")).toEqual(["filinfo"]);
  });

  /**
   * A title the parser does not recognise is its own group, and can be filtered
   * to. It must never be silently folded into a real kind: that is how a
   * certificate ends up listed as a master with nothing saying so.
   */
  it("keeps an unrecognised kind as a group of its own", () => {
    const out = applyProgrammeFilter(programmes, { ...NO_PROGRAMME_FILTER, kinds: [null] });
    expect(out.map((p) => p.code)).toEqual(["weird"]);
    expect(programmeFacets(programmes, NO_PROGRAMME_FILTER).kinds.at(-1)?.value).toBeNull();
  });

  it("filters by site and by text", () => {
    expect(
      applyProgrammeFilter(programmes, { ...NO_PROGRAMME_FILTER, sites: ["Charleroi"] }).map((p) => p.code),
    ).toEqual(["sinc1ba"]);
    expect(
      applyProgrammeFilter(programmes, { ...NO_PROGRAMME_FILTER, text: "informatique" }).length,
    ).toBeGreaterThan(0);
  });

  it("orders the kinds as a progression, not alphabetically", () => {
    // Alphabetical would open on "certificat" and bury "bachelier" in the middle.
    const kinds = programmeFacets(programmes, NO_PROGRAMME_FILTER).kinds.map((k) => k.value);
    expect(kinds.indexOf("bachelier")).toBeLessThan(kinds.indexOf("master"));
    expect(kinds.indexOf("master")).toBeLessThan(kinds.indexOf("mineure"));
  });
});

describe("toggle", () => {
  it("adds what is absent and removes what is present", () => {
    expect(toggle(["a"], "b")).toEqual(["a", "b"]);
    expect(toggle(["a", "b"], "a")).toEqual(["b"]);
  });
});

/**
 * The strings the filters put on screen.
 *
 * The plural check is here because the first version of these keys was written
 * in ICU syntax, "{n, plural, one {# avis} other {# avis}}", which this
 * project's translator does not implement: it uses `key.one` and `key.other`
 * with a `count` variable and `Intl.PluralRules`. The ICU version typechecked,
 * passed every other test, and would have rendered the markup verbatim on the
 * screen. Nothing existing would have caught it.
 */
describe("the filter strings", () => {
  const keys = [
    "ryc.filter.search", "ryc.filter.clear", "ryc.filter.count", "ryc.filter.noMatch",
    "ryc.filter.kind", "ryc.filter.site", "ryc.filter.quarter", "ryc.filter.ects",
    "ryc.filter.language", "ryc.filter.entity", "ryc.filter.reviews",
    "ryc.filter.reviewedOnly", "ryc.filter.searchPlaceholder",
    "ryc.browse.back", "ryc.browse.count", "ryc.browse.noMatch",
    "ryc.browse.noneInProgramme", "ryc.browse.searchPlaceholder",
    "ryc.tab.browse", "ryc.tab.search", "ryc.intro", "ryc.meta",
    "ryc.course.ects", "ryc.course.external",
    "ryc.kind.bachelier", "ryc.kind.master", "ryc.kind.specialisation",
    "ryc.kind.mineure", "ryc.kind.filiere", "ryc.kind.approfondissement",
    "ryc.kind.certificat", "ryc.kind.autre",
  ];

  it("exist in every language", () => {
    for (const locale of LOCALES) {
      const t = createTranslator(rycStrings, locale);
      for (const k of keys) expect(t(k), `${locale}:${k}`).not.toBe(k);
    }
  });

  it("has a name for every kind the parser can return", () => {
    // Including null, which shows as "autre". A kind with no name would render
    // its identifier, so "filiere" would appear on screen instead of "Filière".
    const kinds = [
      "bachelier", "master", "specialisation", "mineure",
      "filiere", "approfondissement", "certificat",
    ];
    for (const locale of LOCALES) {
      const t = createTranslator(rycStrings, locale);
      for (const k of kinds) expect(t(`ryc.kind.${k}`), `${locale}:${k}`).not.toBe(`ryc.kind.${k}`);
    }
  });

  it("pluralises with this project's convention, not ICU", () => {
    for (const locale of LOCALES) {
      const t = createTranslator(rycStrings, locale);
      for (const key of ["ryc.course.reviews", "ryc.browse.courses"]) {
        for (const count of [1, 4]) {
          const out = t(key, { count });
          expect(out, `${locale}:${key}:${count}`).toContain(String(count));
          // The tell-tale of an unimplemented message format reaching a screen.
          expect(out, `${locale}:${key} rendered its own markup`).not.toContain("plural");
          expect(out).not.toContain("{");
        }
      }
    }
  });

  it("every string interpolates all of its placeholders", () => {
    // A leftover "{shown}" on screen is the other way these fail silently.
    const t = createTranslator(rycStrings, DEFAULT_LOCALE);
    expect(t("ryc.filter.count", { shown: 3, total: 9 })).toBe("3 cours sur 9");
    expect(t("ryc.browse.count", { shown: 2, total: 43 })).toBe("2 programmes sur 43");
    expect(t("ryc.meta", { n: 546, from: 2025, to: 2026 })).toBe(
      "546 cours, année académique 2025-2026",
    );
  });
});

/**
 * The bar actually renders.
 *
 * The logic above is pure and proves the arithmetic. This proves the screen:
 * that every string resolves, that a chip carries its count, and that a
 * dimension with one value draws no control. A filter that throws on mount
 * passes every test in this file up to here.
 */
describe("the filter bar on screen", () => {
  const render = (courses: CourseSummary[], counts: Record<string, number> = {}) =>
    renderToStaticMarkup(
      createElement(I18nProvider, {
        locale: DEFAULT_LOCALE,
        bundle: rycStrings,
        children: createElement(CourseFilters, {
          courses,
          reviewCounts: counts,
          onOpen: () => {},
          emptyLabel: "vide",
        }),
      }),
    );

  it("draws a chip per value, with its count", () => {
    const html = render(catalogue, counts);
    expect(html).toContain("Quadrimestre");
    expect(html).toContain("Q1");
    expect(html).toContain("Q2");
    expect(html).toContain("Crédits");
    expect(html).toContain("Langue");
  });

  it("leaves no untranslated key on the page", () => {
    // The tell-tale of a missing string is the key itself rendering.
    const html = render(catalogue, counts);
    expect(html).not.toMatch(/ryc\.[a-z.]+/);
  });

  it("draws no control for a dimension with a single value", () => {
    // One quarter means the quarter filter can only ever be "everything".
    const oneQuarter = catalogue.filter((c) => c.quarter === "Q1");
    expect(render(oneQuarter, counts)).not.toContain("Quadrimestre");
  });

  it("offers the reviews filter only where there is something to read", () => {
    expect(render(catalogue, counts)).toContain("Seulement ceux qui en ont");
    expect(render(catalogue, {})).not.toContain("Seulement ceux qui en ont");
  });

  it("badges a course that has reviews, and shows no rating", () => {
    const html = render(catalogue, counts);
    expect(html).toContain("2 avis");
    // No rating anywhere in a list. A score here would rank coverage rather
    // than quality with 10 courses of 547 reviewed, and FR-D15 keeps
    // per-review numbers off the anonymous path so for many there is none to
    // average. A rating always carries a decimal, which "5 cours sur 5" does
    // not: the first version of this matched the summary line and failed.
    expect(html).not.toMatch(/\d[.,]\d\s*(?:\/|sur)\s*5/);
    expect(html).not.toMatch(/[★☆]/);
  });

  it("says what it is showing", () => {
    expect(render(catalogue, counts)).toContain(`${catalogue.length} cours sur ${catalogue.length}`);
  });
});
