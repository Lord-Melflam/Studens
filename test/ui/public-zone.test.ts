/**
 * The public zone.
 *
 * Two properties are worth a gate. The rest is visual and belongs in a browser.
 *
 * 1. THE PUBLIC PAGES DESCRIBE MODULES THEY DO NOT UNDERSTAND. Everything
 *    concrete comes from `ModuleRegistration.presentation`. The architecture
 *    test enforces the negative (no domain word in apps/web); this enforces the
 *    positive, that the module's own words actually reach the page. Without it,
 *    a landing page could pass the boundary gate by saying nothing at all.
 *
 * 2. LINKS ARE REAL LINKS. A public page exists to be shared, opened in a new
 *    tab and read by a crawler. A div with an onClick does none of those.
 */
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PublicZone, isAppPath, moduleIdFrom, activeModuleFor, APP_PREFIX, bundle } from "@studens/web";
import { rycModule } from "@studens/ryc-ui";
import { modules } from "@studens/web";
import { DEFAULT_LOCALE, I18nProvider, createTranslator, LOCALES, missingKeys } from "@studens/i18n";

/** The module's presentation in a given language, which is how the page gets it. */
const presentationIn = (locale = DEFAULT_LOCALE) =>
  rycModule.presentation(createTranslator(bundle, locale));

const render = (path: string, locale = DEFAULT_LOCALE): string =>
  renderToStaticMarkup(
    createElement(
      I18nProvider,
      { locale, bundle, children: createElement(PublicZone, { path }) },
    ),
  );

/**
 * What a reader sees, rather than what React emitted.
 *
 * Static markup escapes apostrophes to `&#x27;`, and almost every sentence in
 * French copy has one. Asserting on raw markup would mean writing the
 * assertions in HTML entities, which tests the escaper rather than the page.
 */
const text = (html: string): string =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");

describe("the public pages say what the modules say", () => {
  it("the landing page carries the module's own problem statement", () => {
    const body = text(render("/"));
    expect(body).toContain(presentationIn().problem!.title);
    // Not a paraphrase: the module's sentence, verbatim.
    expect(body).toContain(presentationIn().problem!.body[0]!.slice(0, 60));
  });

  it("and its steps, in order", () => {
    const body = text(render("/"));
    const positions = presentationIn().steps!.map((s) => body.indexOf(s.title));
    expect(positions.every((p) => p > -1), "every step should appear").toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("names the module and its status rather than claiming it is ready", () => {
    const body = text(render("/"));
    expect(body).toContain(rycModule.name);
    expect(body).toContain(presentationIn().statusNote);
    expect(body).toContain(rycModule.presentation.status === "live" ? "disponible" : "à venir");
  });

  it("/modules renders the full module detail", () => {
    const body = text(render("/modules"));
    expect(body).toContain(presentationIn().problem!.title);
    expect(body).toContain(presentationIn().steps![0]!.body.slice(0, 40));
    // Detail belongs here rather than on the landing page: it is one module's,
    // and the landing page is the platform's.
    expect(body).toContain(presentationIn().sources!.title);
    for (const item of presentationIn().sources!.items) expect(body).toContain(item);
    for (const h of presentationIn().highlights!) expect(body).toContain(h.title);
  });
});

describe("the landing page shows the product, not only words about it", () => {
  it("renders the module's own mock, which the shell cannot draw", () => {
    const html = render("/");
    // FR-B16 stops apps/web from knowing what a course page looks like, so the
    // mock is the module's. If this disappears, the page has gone back to
    // describing a screenshot instead of showing one.
    expect(html).toContain('class="showcase"');
  });

  it("the mock shows an anonymous contribution with no author and no numbers", () => {
    const html = render("/");
    const anon = html.slice(html.indexOf("review-anonymous"));
    // The marketing mock must not advertise a product we do not ship. FR-D15
    // and FR-C16 mean the server returns neither, so neither appears here.
    expect(anon).toContain("chip-anon");
    expect(anon.slice(0, anon.indexOf("</article>"))).not.toMatch(/recommandé \d\/5/);
  });

  it("declares on the mock what is real and what is illustrated", () => {
    // The reviews in it are invented, because nobody has written one yet. A
    // product asking people to trust a privacy guarantee cannot illustrate
    // itself with numbers that look measured and are not.
    const body = text(render("/"));
    expect(body).toMatch(/exemple/i);
    expect(body).toMatch(/fictif/i);
  });

  it("ends on the module's own first action, not a generic one", () => {
    expect(text(render("/"))).toContain(presentationIn().firstAction!.title);
  });

  it("says there is nothing to accept, because there is no analytics cookie", () => {
    // A claim worth a test: it stops being true the moment someone adds a
    // tracker, and the page would then be lying rather than merely stale.
    expect(text(render("/"))).toMatch(/aucun cookie|rien à accepter/i);
  });
});

describe("the platform speaks for itself, and modules are what is inside it", () => {
  it("lists every module, planned ones included, with its status", () => {
    const body = text(render("/"));
    const t = createTranslator(bundle, DEFAULT_LOCALE);
    for (const m of modules) {
      expect(body, `${m.id} should be listed`).toContain(m.name);
      expect(body).toContain(m.presentation(t).statusNote);
    }
    expect(body).toContain("à venir");
    expect(body).toContain("disponible");
  });

  it("invents nothing for a module that is not built", () => {
    const planned = modules.filter(
      (m) => m.presentation(createTranslator(bundle, DEFAULT_LOCALE)).status === "planned",
    );
    expect(planned.length, "this test needs a planned module to mean anything").toBeGreaterThan(0);
    const t = createTranslator(bundle, DEFAULT_LOCALE);
    for (const m of planned) {
      // A problem statement and a feature list for something unbuilt is how a
      // roadmap turns into a promise. The type makes it optional; this makes
      // sure nobody fills it in to balance the page visually.
      const pres = m.presentation(t);
      expect(pres.problem, `${m.id} must carry no problem statement`).toBeUndefined();
      expect(pres.steps).toBeUndefined();
      expect(pres.showcase).toBeUndefined();
      expect(m.component, `${m.id} must not be mountable`).toBeUndefined();
    }
  });

  it("states the platform's own promises, not one module's", () => {
    const body = text(render("/"));
    // These hold across every module and are the shell's to make. If they ever
    // come from a module's presentation, the landing page has become that
    // module's page again.
    expect(body).toMatch(/ind[ée]pendant/i);
    expect(body).toMatch(/aucun cookie|rien qui vous piste/i);
    expect(body).toMatch(/anonym/i);
  });
});

describe("FR-F3: signing in and creating an account are one act", () => {
  it("both labels lead to the same place", () => {
    const html = render("/");
    for (const label of ["Se connecter", "Créer un compte"]) {
      expect(text(html)).toContain(label);
    }
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    // Every internal link carries the language, so the target is prefixed.
    expect(hrefs).toContain(`/${DEFAULT_LOCALE}/connexion`);
    // No separate registration route exists to drift from the sign-in one.
    expect(hrefs.filter((h) => h?.includes("inscription"))).toEqual([]);
  });
});

describe("a public page is a page, not an application screen", () => {
  const paths = ["/", "/modules", "/confidentialite", "/a-propos"];

  it("every internal navigation is a real anchor with an href", () => {
    for (const path of paths) {
      const html = render(path);
      // If navigation were divs with handlers, this count would be zero and the
      // pages would be unshareable and invisible to a crawler.
      const internal = [...html.matchAll(/<a[^>]+href="(\/[^"]*)"/g)];
      expect(internal.length, `${path} should carry internal links`).toBeGreaterThan(3);
    }
  });

  it("every outbound link is rel=noopener noreferrer", () => {
    for (const path of paths) {
      const html = render(path);
      for (const tag of html.match(/<a[^>]+href="https?:[^"]*"[^>]*>/g) ?? []) {
        expect(tag, `${path}: outbound link without rel`).toContain("noopener");
        expect(tag).toContain("noreferrer");
      }
    }
  });

  it("states that Studens is affiliated with nobody, on every page", () => {
    // The disclaimer moved out of the app footer. It must not have been lost:
    // the visual register borrows from the institutions, so the words carry
    // what a colour cannot.
    for (const path of paths) {
      expect(render(path)).toMatch(/affili/i);
    }
  });

  it("an unknown public path shows the landing page, not a dead end", () => {
    expect(text(render("/quelque-chose"))).toContain(presentationIn().problem!.title);
  });
});

describe("the zone boundary", () => {
  it("only /app and below is the application", () => {
    expect(isAppPath("/app")).toBe(true);
    expect(isAppPath("/app/ryc")).toBe(true);
    for (const p of ["/", "/modules", "/a-propos", "/connexion", "/application", "/appareil"]) {
      expect(isAppPath(p), `${p} must stay public`).toBe(false);
    }
  });

  it("reads the module id out of the path, not out of a hash", () => {
    expect(moduleIdFrom(`${APP_PREFIX}/ryc`)).toBe("ryc");
    expect(moduleIdFrom(`${APP_PREFIX}/ryc/anything/deeper`)).toBe("ryc");
    expect(moduleIdFrom(APP_PREFIX)).toBeNull();
    expect(moduleIdFrom("/modules")).toBeNull();
  });

  /**
   * Regression, 2026-09-12. The Shell passes `window.location.pathname`, which
   * carries the language, and these were matching on `/app` only. So
   * `/fr/app/ryc` produced no module id: the URL changed and the screen stayed
   * on the home list, which reads as a dead button.
   *
   * Nothing caught it because every existing case here used a path that had
   * already been stripped, which is the form the router produces internally and
   * NOT the form a browser hands you.
   */
  it("works on a path that still carries its language", () => {
    for (const locale of LOCALES) {
      expect(isAppPath(`/${locale}/app`), `/${locale}/app`).toBe(true);
      expect(isAppPath(`/${locale}/app/ryc`)).toBe(true);
      expect(moduleIdFrom(`/${locale}/app/ryc`), `/${locale}/app/ryc`).toBe("ryc");
      expect(moduleIdFrom(`/${locale}/app/ryc/course/lepl1503`)).toBe("ryc");
      expect(moduleIdFrom(`/${locale}/app`)).toBeNull();

      // And a public path with a language is still public.
      expect(isAppPath(`/${locale}`)).toBe(false);
      expect(isAppPath(`/${locale}/modules`)).toBe(false);
      expect(moduleIdFrom(`/${locale}/modules`)).toBeNull();
    }
  });

  it("resolves the module the Shell will actually mount", () => {
    // The end of the chain the bug broke: path to id to registered module. The
    // id check above would still pass if the registry lookup were wrong, and
    // the visible symptom was the same either way, so both halves are checked.
    for (const locale of LOCALES) {
      expect(activeModuleFor(`/${locale}/app/ryc`)?.id).toBe("ryc");
      expect(activeModuleFor(`/${locale}/app`)).toBeNull();
      expect(activeModuleFor(`/${locale}/modules`)).toBeNull();
    }
    expect(activeModuleFor("/app/ryc")?.id).toBe("ryc");
    // An id in the URL that is not a live module mounts nothing rather than
    // throwing: a planned module has no component, and a typo is a typo.
    expect(activeModuleFor("/fr/app/mpa")).toBeNull();
    expect(activeModuleFor("/fr/app/nonsense")).toBeNull();
  });

  it("still works on a path that has already been stripped", () => {
    // Stripping twice must be harmless: main.tsx strips before calling.
    expect(isAppPath("/app/ryc")).toBe(true);
    expect(moduleIdFrom("/app/ryc")).toBe("ryc");
  });
});

describe("FR-G: three languages, and the locale is in the path", () => {
  it("every key exists in every language", () => {
    // A key missing from Dutch falls back to French, which is right for the
    // reader and wrong for everyone else: nobody notices a page that quietly
    // reverts. This is the only thing that notices.
    expect(missingKeys(bundle)).toEqual([]);
  });

  it("no string is left empty, which would render as a blank rather than a bug", () => {
    for (const locale of LOCALES) {
      for (const [key, value] of Object.entries(bundle[locale])) {
        expect(value.trim(), `${locale}:${key} is empty`).not.toBe("");
      }
    }
  });

  it("renders the same page in each language, and differently", () => {
    const rendered = LOCALES.map((l) => text(render("/", l)));
    for (const [i, locale] of LOCALES.entries()) {
      expect(rendered[i], `${locale} should not show raw keys`).not.toMatch(/\bhero\.title\b/);
    }
    // Three languages, three different pages. If two matched, one was falling
    // back to the other and the switcher would be decoration.
    expect(new Set(rendered).size).toBe(LOCALES.length);
  });

  it("the module's own copy is translated too, not only the shell's", () => {
    const nl = text(render("/", "nl"));
    expect(nl).toContain(presentationIn("nl").problem!.title);
    expect(nl).not.toContain(presentationIn("fr").problem!.title);
  });

  it("the switcher links to the same page in the other languages", () => {
    const html = render("/a-propos", "nl");
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    for (const l of LOCALES) expect(hrefs).toContain(`/${l}/a-propos`);
  });

  it("language names are in their own language, never translated", () => {
    // A Dutch speaker looks for "Nederlands", not for "Néerlandais".
    for (const locale of LOCALES) {
      const body = text(render("/", locale));
      expect(body).toContain("Nederlands");
      expect(body).toContain("Français");
      expect(body).toContain("English");
    }
  });

  it("says that institutional content stays in its own language", () => {
    // A Dutch-speaking reader landing on a French course description should
    // know that is the institution's doing, not a gap in the product.
    for (const locale of LOCALES) expect(text(render("/", locale))).toContain(
      createTranslator(bundle, locale)("lang.note"),
    );
  });
});
