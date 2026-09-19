/**
 * Every screen behind a session actually renders.
 *
 * THIS TEST EXISTS BECAUSE TWO BUGS IN A ROW GOT PAST 350 OTHERS.
 *
 * On 2026-09-13 the app was shipped twice in a state anybody using it hit
 * immediately and no test could: first a redirect that made the whole app unreachable while
 * the setup was unfinished, then a blank page. Both were on the signed-in path,
 * and every existing test rendered either the public zone or a component in
 * isolation with no session at all. `/api/session` answers "nobody" without a
 * cookie, so the entire product behind sign-in was, in test terms, never drawn.
 *
 * So these render the real trees, with a real session, in the states a member
 * is actually in. They do not assert much about the markup on purpose: the
 * point is that rendering does not throw, which is what a blank page is.
 */
import { describe, expect, it } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_LOCALE, I18nProvider } from "@studens/i18n";
import {
  Shell,
  SessionProvider,
  Settings,
  FirstRun,
  bundle,
  signOutDestination,
  takesPowerAway,
  sectionFrom,
  SECTIONS,
  type SessionState,
} from "@studens/web";

/** Signed in, has never opened the first run. The state that broke. */
const fresh: SessionState = {
  signedIn: true,
  emailDomain: "student.uclouvain.be",
  role: "member",
  username: null,
  onboarded: false,
  onboardingStep: 0,
  devSignInAvailable: true,
};

const settled: SessionState = {
  ...fresh,
  username: "lou.martin",
  onboarded: true,
  onboardingStep: 5,
};

function draw(children: ReactNode, session: SessionState | null): string {
  return renderToStaticMarkup(
    createElement(I18nProvider, {
      locale: DEFAULT_LOCALE,
      bundle,
      children: createElement(SessionProvider, { initial: session, children }),
    }),
  );
}

/**
 * The path drives the shell, so each case sets it before rendering.
 *
 * A four-line `window` rather than a DOM library. Rendering to a string runs no
 * effects and touches no node, so the only browser thing these screens read is
 * `location.pathname`, and the router already guards every other access. A real
 * DOM would be a dependency bought to hold one string.
 */
function at(path: string): void {
  (globalThis as { window?: unknown }).window = {
    location: { pathname: path, search: "" },
    history: { replaceState: () => {}, pushState: () => {} },
    addEventListener: () => {},
    removeEventListener: () => {},
    scrollTo: () => {},
  };
}

describe("the app renders for a signed-in member", () => {
  for (const [name, session] of [
    ["with the setup unfinished", fresh],
    ["with the setup done", settled],
  ] as const) {
    it(`draws the module list ${name}`, () => {
      at("/fr/app");
      const html = draw(createElement(Shell), session);
      expect(html).toContain("Rate Your Courses");
      expect(html).not.toContain("undefined");
    });

    it(`draws a module ${name}`, () => {
      at("/fr/app/ryc");
      const html = draw(createElement(Shell), session);
      expect(html.length).toBeGreaterThan(100);
      expect(html).not.toContain("undefined");
    });

    it(`draws the account panel ${name}`, () => {
      at("/fr/app/moi");
      const html = draw(createElement(Settings), session);
      expect(html.length).toBeGreaterThan(100);
    });
  }

  /**
   * The reminder is the counterpart to letting the setup be skipped: it shows
   * while it is unfinished and must vanish once it is done, or it becomes a
   * permanent nag about something already handled.
   */
  it("shows the unfinished-setup line, and only while it is unfinished", () => {
    at("/fr/app");
    // Matched on the class, not the sentence: the copy contains an apostrophe
    // and renders as `n&#x27;est`, so asserting the French failed on the markup
    // rather than on the behaviour.
    expect(draw(createElement(Shell), fresh)).toContain('class="setup-prompt"');
    expect(draw(createElement(Shell), settled)).not.toContain('class="setup-prompt"');
  });

  it("shows the chosen name in the app header once there is one", () => {
    at("/fr/app");
    expect(draw(createElement(Shell), settled)).toContain("lou.martin");
  });

  /**
   * Signing out does not empty the app, it changes who is looking at it, and
   * the header has to follow. It did not: signing out of the console left the
   * page offering an account screen that can only fail, while the
   * console's own URL answered with the message meant for a stranger guessing
   * it. What is drawn comes from the session now, so the header is right the
   * moment the session changes rather than the next time the page is loaded.
   */
  it("offers the account screen to somebody signed in, and not to somebody signed out", () => {
    at("/fr/app/ryc");
    const signedOut: SessionState = { signedIn: false, devSignInAvailable: true };
    expect(draw(createElement(Shell), settled)).toContain("/fr/app/moi");
    expect(draw(createElement(Shell), signedOut)).not.toContain("/fr/app/moi");
  });

  /**
   * The console's segment answers exactly as any unknown one does to anybody
   * without the power. That sameness is the point: the API answers 404 rather
   * than 403 so the console cannot be confirmed to exist, and a screen that
   * said something different here would hand back what the API withholds.
   */
  it("says nothing about the console to somebody who cannot open it", () => {
    at("/fr/app/moderation");
    const html = draw(createElement(Shell), settled);
    at("/fr/app/pas-un-module");
    const unknown = draw(createElement(Shell), settled);
    // The same answer, and nothing else on the page that names the console.
    // The language switcher does carry the current path, so this asserts on the
    // link and the breadcrumb rather than on the string appearing at all.
    expect(html).toContain('class="error"');
    expect(unknown).toContain('class="error"');
    expect(html).not.toContain('class="settings-link" href="/fr/app/moderation"');
    expect(html).not.toContain('class="here"');
    expect(html.replace(/<nav class="lang".*?<\/nav>/s, "")).not.toContain("Modération");
  });
});

describe("the first run renders at every step", () => {
  for (let step = 1; step <= 5; step++) {
    it(`draws step ${step}`, () => {
      at(`/fr/bienvenue/${step}`);
      const html = draw(
        createElement(FirstRun, { route: `/bienvenue/${step}`, onDone: () => {} }),
        fresh,
      );
      // Before the profile arrives every step draws the same placeholder, which
      // is correct and is also what a broken fetch looks like forever. The
      // point here is only that the component mounts without throwing.
      expect(html.length).toBeGreaterThan(0);
      expect(html).not.toContain("undefined");
    });
  }
});

describe("no screen leaks an untranslated key", () => {
  it("neither the shell nor the account panel", () => {
    // A missing string renders as its own key, which no other test would fail
    // on: the page still looks like a page.
    at("/fr/app");
    expect(draw(createElement(Shell), fresh)).not.toMatch(/\b(?:app|nav|settings|foot)\.[a-z.]+/);
    at("/fr/app/moi");
    expect(draw(createElement(Settings), settled)).not.toMatch(
      /\b(?:app|nav|settings|foot)\.[a-z.]+/,
    );
  });
});

/**
 * Signing out is a full page load, so a screen that cannot be rendered signed
 * out has to be left before it happens, not after. The first attempt reacted to
 * the session instead and did nothing at all: the page came back fresh on the
 * console's URL, the change it was waiting for had already happened, and
 * The same "Unknown module" turned up a second time.
 */
describe("signing out leaves the application", () => {
  it("lands on the public home, from every screen, in the reader's language", () => {
    for (const [route, locale, expected] of [
      ["moderation", "fr", "/fr"],
      ["moi", "en", "/en"],
      // A course page is public and survives signing out, which is exactly why
      // staying on one looked like signing out had failed: same screen, same
      // content, and on a shared laptop somebody who thinks they have left.
      ["ryc", "fr", "/fr"],
      [null, "nl", "/nl"],
    ] as const) {
      expect(signOutDestination(route, locale)).toBe(expected);
    }
  });

  it("never lands inside the application", () => {
    // `/app` was the old answer for the console and the account panel, and the
    // application is the thing being left.
    for (const route of ["moderation", "moi", "ryc", null] as const) {
      expect(signOutDestination(route, "fr")).not.toContain("/app");
    }
  });
});

/**
 * Taking a power away asks first; giving one does not.
 *
 * The direction is read from the order the API sends the roles in, which runs
 * from fewest powers to most. A role added later therefore gets its rank with
 * no change here, which is the point of sending the list at all.
 */
describe("a demotion is confirmed, a promotion is not", () => {
  const roles = ["member", "moderator", "admin"];

  it("asks only when the change removes something", () => {
    expect(takesPowerAway(roles, "moderator", "member")).toBe(true);
    expect(takesPowerAway(roles, "admin", "moderator")).toBe(true);
    expect(takesPowerAway(roles, "admin", "member")).toBe(true);

    expect(takesPowerAway(roles, "member", "moderator")).toBe(false);
    expect(takesPowerAway(roles, "moderator", "admin")).toBe(false);
    expect(takesPowerAway(roles, "admin", "admin")).toBe(false);
  });

  it("treats a role it does not know as no change, never as a demotion", () => {
    // Confirming an upgrade would teach people to confirm everything, and then
    // the confirmation that mattered is the one they click through.
    expect(takesPowerAway(roles, "admin", "auditor")).toBe(false);
    expect(takesPowerAway(roles, "auditor", "member")).toBe(false);
  });

  it("follows the order it is given, not one written into the screen", () => {
    // The same two roles, ordered the other way round, reverse the answer.
    expect(takesPowerAway(["admin", "member"], "member", "admin")).toBe(true);
  });
});

/**
 * THE CONSOLE'S SECTIONS, and the address that picks one.
 *
 * The console was one column of panels: the queue, then suspending, then
 * settings, then appointments. Each new administrator power was another panel
 * pushing the queue, which is the daily work, further down a page somebody
 * scrolls past to reach. Sections absorb that growth, and the section is in
 * the address (FR-B21) so it survives a refresh and can be linked to.
 */
describe("which section the address asks for", () => {
  it("lands on the reports queue by default", () => {
    expect(sectionFrom("", true)).toBe("signalements");
    expect(sectionFrom("?", false)).toBe("signalements");
  });

  it("opens the one named, for somebody who holds the powers", () => {
    for (const id of SECTIONS) {
      expect(sectionFrom(`?section=${id}`, true)).toBe(id);
    }
  });

  /**
   * A moderator who is not an administrator opens an administrator's link and
   * gets the screen they can use, not an error. The API answers 404 to every
   * request behind those sections anyway, so this is about not showing
   * somebody an empty panel, never about keeping them out.
   */
  it("sends a moderator back to the queue, whatever the link said", () => {
    expect(sectionFrom("?section=comptes", false)).toBe("signalements");
    expect(sectionFrom("?section=roles", false)).toBe("signalements");
    expect(sectionFrom("?section=reglages", false)).toBe("signalements");
  });

  it("ignores a name it does not know rather than drawing nothing", () => {
    expect(sectionFrom("?section=comptez", true)).toBe("signalements");
    expect(sectionFrom("?section=", true)).toBe("signalements");
  });

  it("leaves the other settings in the address alone", () => {
    // The console shares a query string with nothing today, and will not be
    // the reason that stops being true.
    expect(sectionFrom("?q=lepl&section=roles", true)).toBe("roles");
  });
});
