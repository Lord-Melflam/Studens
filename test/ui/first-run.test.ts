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
 * FR-F7, and the reason people can answer screen four truthfully.
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
 * somewhere else. From outside it looks like the module disappearing:
 * pressing RYC simply stops.
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

/**
 * Finishing the first run gets you into the app.
 *
 * REPORTED 2026-09-13: "I'm stuck at the 5th page of registering. Selected
 * uclouvain but can't move further." Nothing was wrong with the save. The
 * account was written correctly, onboarded, with the institution set. The
 * Finish button navigated to /app, `Zone` decided whether to divert from the
 * session it had fetched ON MOUNT, which still said the first run had never
 * been opened, and sent them straight back. The wizard then resumed at their
 * saved step 5. Pressing Finish looked like pressing nothing.
 *
 * Two properties keep it fixed, and they are separate: the session is refreshed
 * BEFORE the navigation, and the refresh is waited for.
 */
describe("finishing lands in the app, not back in the wizard", () => {
  const main = read("apps/web/src/main.tsx");
  const session = read("apps/web/src/session.tsx");

  it("refreshes the session before navigating away from the first run", () => {
    const onDone = /onDone=\{[\s\S]*?\}\}/.exec(main)?.[0] ?? "";
    expect(onDone, "the first run's onDone should be findable").not.toBe("");
    expect(onDone, "navigating on a stale session is what caused the bounce").toContain("reload");
    expect(onDone).toContain("takeDestination");
  });

  /**
   * The promise is the point. A `reload()` that returns void can be called and
   * not waited for, and the navigation then happens against the old answer,
   * which is exactly the bug with an extra line of code in front of it.
   */
  it("the reload resolves only once the new answer is in state", () => {
    expect(session).toMatch(/reload:\s*\(\)\s*=>\s*Promise<void>/);
    expect(session).toMatch(/const reload = useCallback\(async/);
    const onDone = /onDone=\{[\s\S]*?\}\}/.exec(main)?.[0] ?? "";
    expect(onDone, "the navigation must be chained onto the reload").toMatch(
      /reload\(\)\s*\.then|await reload\(\)/,
    );
  });

  /**
   * The other half of what made it invisible: only step two could show an
   * error, so a refused save on any other screen did nothing at all and left
   * nothing to read.
   */
  it("shows a failure on every step, not only on the username one", () => {
    const wizard = read("apps/web/src/firstrun/FirstRun.tsx");
    expect(wizard).toContain("step !== 2");
    expect(wizard).toContain("firstrun.err.save");
    for (const locale of LOCALES) {
      const t = createTranslator(bundle, locale);
      expect(t("firstrun.err.save"), `${locale}`).not.toBe("firstrun.err.save");
    }
  });
});

/**
 * STEP 5 IS A MULTIPLE CHOICE, and the choice is not exclusive.
 *
 * Students do follow courses at two universities at once, so this screen may
 * not ask for one answer. A student registered at one university and taking a
 * minor at
 * another is not an edge case here, it is two of the three institutions this
 * product launches with, twenty kilometres apart.
 *
 * Checked against the source rather than a rendered screen: the first run
 * fetches its profile before it draws anything real, so a server render of
 * step 5 is the placeholder and says nothing about what the buttons do.
 */
describe("step 5 takes more than one university", () => {
  const wizard = read("apps/web/src/firstrun/FirstRun.tsx");

  it("holds a set, not a single code", () => {
    expect(wizard).toMatch(/useState<string\[\]>\(\[\]\)/);
  });

  it("presses off as well as on", () => {
    // A radio group that cannot be unpicked is the exclusive choice this
    // replaced, wearing a different control.
    expect(wizard).toContain("was.filter((c) => c !== i.code)");
    expect(wizard).toContain("[...was, i.code]");
  });

  it("writes every one that was chosen, not only the first", () => {
    // `institutionCode` on the profile holds one. The rest are the member's
    // own set, so the finish writes them there before it ends the first run.
    expect(wizard).toContain("codes.slice(1)");
    expect(wizard).toContain("addMyInstitution(code)");
  });
});

/**
 * THE WIZARD MUST NOT FREEZE AFTER ONE STEP.
 *
 * Shipped broken and found by using it: press Commencer, land on step 2 with
 * the username already filled in, and every control on that screen is
 * disabled. Back too, which is the tell. Nothing failed, so there was no error
 * to read; the screen simply stopped responding.
 *
 * `saving` disables every button while a save is in flight. Moving between
 * steps does NOT unmount the component, it renders a different section of
 * itself, so the flag survives the navigation and has to be cleared by hand.
 * It was a `finally`, which did that for every path. Then finishing needed to
 * stay busy, because clearing it before the session reload made the button
 * live again while nothing visible was happening and it got pressed twice, so
 * the reset moved into `catch`. That quietly took it away from the four steps
 * that are not the finish.
 *
 * Both halves are pinned here, because fixing either one by reaching for a
 * `finally` again breaks the other.
 *
 * READ FROM THE SOURCE, which is second best and is deliberate. Proving it by
 * behaviour needs a DOM, and jsdom plus a rendering library is a large
 * dependency for one assertion in a project that runs on two (CON-1). The
 * same trade the mail templates and the stylesheet gates already make.
 */
describe("a step that is not the last one re-enables its buttons", () => {
  const source = read("apps/web/src/firstrun/FirstRun.tsx");
  const save = /const save = useCallback\(([\s\S]*?)\n {2}\);/.exec(source)?.[1] ?? "";

  it("finds the save callback, so the checks below are not vacuous", () => {
    expect(save).toContain("setSaving(true)");
    expect(save).toContain("navigate(firstRunPath(next))");
  });

  it("clears the busy flag after moving to the next step", () => {
    // Bounded at the catch on purpose. The failure path clears the flag too,
    // so a search that ran to the end of the function passed with the bug
    // still in place: the first version of this test did exactly that.
    const from = save.indexOf("navigate(firstRunPath(next))");
    const to = save.indexOf("} catch", from);
    const after = save.slice(from, to === -1 ? undefined : to);
    expect(
      after,
      "moving between steps leaves this component mounted, so `saving` " +
        "survives the navigation. Without this the next screen renders with " +
        "every button disabled and no error, which is what shipped.",
    ).toContain("setSaving(false)");
  });

  /** The other half: the finish path stays busy on purpose. */
  it("leaves it set when the screen is leaving for good", () => {
    const branch = /if \(next > STEPS\) \{([\s\S]*?)\n {8}\}/.exec(save)?.[1] ?? "";
    expect(branch, "the finish branch should be findable").toContain("onDone()");
    expect(
      branch.includes("setSaving(false)"),
      "finishing is three round trips and the screen is leaving; re-enabling " +
        "the button mid-way is what made it get pressed twice",
    ).toBe(false);
  });

  /**
   * And a failure must always give the controls back, whichever step it was
   * on. This is the path that shows an error, and an error nobody can act on
   * is worse than the freeze.
   */
  it("clears it when the save fails", () => {
    const failure = save.slice(save.indexOf("} catch (err)"));
    expect(failure).toContain("setSaving(false)");
  });
});
