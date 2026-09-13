/**
 * The first run: the rules that do not need a database.
 *
 * The properties held here are the ones an ordinary change would break without
 * anything going red: a step that stops being resumable, a profile field that
 * quietly reaches a published review, a username rule that loosens.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { LOCALES, createTranslator } from "@studens/i18n";
import { bundle } from "@studens/web";
import { FIRST_RUN, STEPS, firstRunPath, hasExplicitStep, isFirstRunPath, stepFrom } from "@studens/web";
import { USERNAME_MAX, USERNAME_MIN, UsernameInvalid, checkUsername } from "@studens/platform";

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url).pathname, "utf8");

describe("every step is a place you can come back to (FR-F5)", () => {
  it("recognises its own zone and nothing else", () => {
    expect(isFirstRunPath(FIRST_RUN)).toBe(true);
    expect(isFirstRunPath(`${FIRST_RUN}/3`)).toBe(true);
    expect(isFirstRunPath("/app")).toBe(false);
    expect(isFirstRunPath("/")).toBe(false);
    // Not a prefix match on the string: /bienvenue-ailleurs is another page.
    expect(isFirstRunPath("/bienvenue-ailleurs")).toBe(false);
  });

  it("reads the step out of the path", () => {
    expect(stepFrom(`${FIRST_RUN}/1`)).toBe(1);
    expect(stepFrom(`${FIRST_RUN}/4`)).toBe(4);
  });

  it("clamps rather than rendering an empty screen", () => {
    // These arrive from typed URLs and from stale links, not only from us.
    expect(stepFrom(`${FIRST_RUN}/0`)).toBe(1);
    expect(stepFrom(`${FIRST_RUN}/99`)).toBe(STEPS);
    expect(stepFrom(`${FIRST_RUN}/quoi`)).toBe(1);
    expect(firstRunPath(0)).toBe(`${FIRST_RUN}/1`);
    expect(firstRunPath(STEPS + 5)).toBe(`${FIRST_RUN}/${STEPS}`);
  });

  /**
   * The bare prefix means "wherever I was", which is what makes the saved step
   * usable: the redirect out of the app sends people to /bienvenue with no
   * number, and the wizard resolves it from the server's answer. If this ever
   * reported true, the resume would be skipped and everyone would restart at
   * screen one.
   */
  it("tells a bare prefix from an explicit step", () => {
    expect(hasExplicitStep(FIRST_RUN)).toBe(false);
    expect(hasExplicitStep(`${FIRST_RUN}/`)).toBe(false);
    expect(hasExplicitStep(`${FIRST_RUN}/2`)).toBe(true);
  });
});

describe("the username rule (FR-F6, FR-F9)", () => {
  it("accepts an ordinary name and lowercases it", () => {
    expect(checkUsername("lou.martin")).toBe("lou.martin");
    expect(checkUsername("  Lou_Martin  ")).toBe("lou_martin");
    expect(checkUsername("a1b")).toBe("a1b");
  });

  const refused = (name: string, reason: string) => {
    let thrown: unknown;
    try {
      checkUsername(name);
    } catch (e) {
      thrown = e;
    }
    expect(thrown, `${name} should be refused`).toBeInstanceOf(UsernameInvalid);
    expect((thrown as UsernameInvalid).reason).toBe(reason);
  };

  it("refuses what would read as something it is not", () => {
    refused("ab", "short");
    refused("a".repeat(USERNAME_MAX + 1), "long");
    refused(".lou", "shape");
    refused("lou.", "shape");
    refused("lou..martin", "shape");
    refused("lou@example.invalid", "shape");
    refused("lou martin", "shape");
    // A name beside somebody's opinion of a named lecturer must not be able to
    // pass for the platform speaking.
    refused("studens", "reserved");
    refused("MODERATOR", "reserved");
    refused("anonyme", "reserved");
  });

  it("has a floor, so a single letter cannot be squatted", () => {
    expect(USERNAME_MIN).toBeGreaterThanOrEqual(3);
  });
});

/**
 * FR-F7, and the reason people can answer screen four honestly.
 *
 * Checked against the module's source rather than against a rendered page,
 * because the property is "the module never receives these", and a page can be
 * right today by accident.
 */
describe("no profile field can reach a contribution (FR-F7)", () => {
  const readModule = read("packages/ryc/src/read.ts");

  it("the published review shape has no profile field", () => {
    for (const field of ["studies", "yearOfStudy", "interests", "institutionCode", "emailDomain"]) {
      expect(readModule, `${field} reached the module that publishes reviews`).not.toContain(field);
    }
  });

  /**
   * The module resolves a username through a function it is handed, never by a
   * query. `studens_ryc` holds no grant on platform.Member, so a direct lookup
   * would fail at runtime rather than at review time, which is the wrong place
   * to find out.
   */
  it("the module reads no member table of its own", () => {
    expect(readModule).not.toMatch(/prisma\.member\b/);
    expect(readModule).toContain("NameResolver");
  });
});

describe("the first run says what it is doing, in every language", () => {
  const keys = [
    "firstrun.step", "firstrun.start", "firstrun.back", "firstrun.next",
    "firstrun.skip", "firstrun.finish", "firstrun.later",
    "firstrun.1.title", "firstrun.1.lede", "firstrun.1.known",
    "firstrun.2.title", "firstrun.2.rule", "firstrun.2.public",
    "firstrun.2.err.short", "firstrun.2.err.long", "firstrun.2.err.shape",
    "firstrun.2.err.reserved", "firstrun.2.err.taken", "firstrun.2.err.other",
    "firstrun.3.title", "firstrun.3.note",
    "firstrun.4.title", "firstrun.4.studies", "firstrun.4.year", "firstrun.4.never",
    "firstrun.5.title", "firstrun.5.soon", "firstrun.5.declared",
  ];

  it("has every string it renders", () => {
    for (const locale of LOCALES) {
      const t = createTranslator(bundle, locale);
      for (const k of keys) expect(t(k), `${locale}:${k}`).not.toBe(k);
    }
  });

  /**
   * Every reason a name can be refused has a sentence. A missing one renders
   * as the key, so somebody would see "firstrun.2.err.taken" where they needed
   * to be told the name was gone.
   */
  it("has a sentence for every way the username rule can say no", () => {
    const reasons = ["short", "long", "shape", "reserved", "taken"];
    const source = read("packages/platform/src/profile.ts");
    for (const r of reasons) {
      expect(source, `${r} is no longer a reason the rule gives`).toContain(`"${r}"`);
      for (const locale of LOCALES) {
        const t = createTranslator(bundle, locale);
        expect(t(`firstrun.2.err.${r}`), `${locale}:${r}`).not.toBe(`firstrun.2.err.${r}`);
      }
    }
  });
});

/**
 * FR-F13. The institution is a statement about oneself, not a credential.
 *
 * If this ever changed, nothing else would notice: the screen would look the
 * same and the member would quietly gain a tenant they do not belong to, which
 * is the boundary FR-C19 draws (the tenant comes from the target, never from
 * the author, and never from what the author typed).
 */
describe("declaring an institution grants nothing (FR-F13)", () => {
  it("the profile writer cannot touch the tenant or the role", () => {
    const source = read("packages/platform/src/profile.ts");
    expect(source).not.toContain("tenantId");
    expect(source).not.toContain('"role"');
  });

  it("the profile route writes only the fields it names", () => {
    // A spread of the request body into `update` would let a caller set any
    // column on their own Member row, role included.
    const source = read("apps/api/src/routes/profile.ts");
    expect(source).not.toMatch(/data:\s*\{?\s*\.\.\./);
    expect(source).not.toMatch(/\.\.\.\s*req\.body/);
  });
});

/**
 * The first run must not become a room with no door.
 *
 * SHIPPED AND REPORTED, 2026-09-13. The redirect diverted every /app route
 * whenever `onboarded` was false. The wizard's only visible way out went to the
 * public home, and the public home's way in went to /app, which diverted again.
 * There was no path into the product that did not pass through finishing the
 * setup, and nothing on screen said why: clicking a module simply put you
 * somewhere else. François hit it as "ryc is gone ... when I click on ryc, it
 * stops", which is exactly what it looks like from outside.
 *
 * These read the source rather than a rendered screen because the property is
 * about which states can reach which, and there are four files involved.
 */
describe("the first run can be left (FR-F4, and FR-F6's reasoning)", () => {
  const main = read("apps/web/src/main.tsx");
  const wizard = read("apps/web/src/firstrun/FirstRun.tsx");
  const shell = read("apps/web/src/shell/Shell.tsx");

  /**
   * Only somebody who has NEVER OPENED it is sent there. Diverting on
   * `onboarded === false` alone is the trap: that stays false for as long as
   * the setup is unfinished, which is for as long as somebody keeps declining
   * to do it, which is forever.
   */
  it("diverts only a member who has never opened it", () => {
    expect(main).toContain("onboardingStep === 0");
    const divert = /const\s+divert\s*=[^;]+;/.exec(main)?.[0] ?? "";
    expect(divert, "the divert condition must be narrowed by neverOpened").toContain("neverOpened");
  });

  it("lets somebody out of it, into the app and not out of the product", () => {
    // The escape used to be `linkProps("/")`, which is the public home, and
    // the public home leads back to /app.
    expect(wizard).toMatch(/function later\(\)/);
    expect(wizard).toContain("onboardingStep: 1");
    expect(
      wizard.includes('linkProps("/")'),
      "the way out of the first run must not be the public home: that is the loop",
    ).toBe(false);
  });

  /**
   * The other half of letting somebody skip it. Once the app stops forcing the
   * setup, the setup has to stay visible, or a member who declined once has no
   * username and no way back to choosing one.
   */
  it("keeps the unfinished setup visible inside the app", () => {
    expect(shell).toContain("SetupPrompt");
    expect(shell).toContain("app.setup.prompt");
    for (const locale of LOCALES) {
      const t = createTranslator(bundle, locale);
      for (const k of ["app.setup.prompt", "app.setup.go"]) {
        expect(t(k), `${locale}:${k}`).not.toBe(k);
      }
    }
  });

  /**
   * Finishing returns you where you were going. Clicking a module, being sent
   * to a setup you did not ask for, and then being dropped at the app's front
   * door loses what you were doing, which is a smaller version of the same
   * problem.
   */
  it("remembers the destination and only ever restores an app path", () => {
    expect(main).toContain("rememberDestination");
    expect(main).toContain("takeDestination");
    const take = /function takeDestination[\s\S]*?\n}/.exec(main)?.[0] ?? "";
    expect(take, "a stored value must be checked before it is navigated to").toContain(
      "isAppPath(saved)",
    );
    // Storage throws in a private window rather than returning nothing.
    expect(take).toContain("catch");
  });

  it("still sends a signed-out visitor away from the wizard", () => {
    expect(main).toContain("strayed");
    expect(main).toContain('navigate("/connexion")');
  });
});
