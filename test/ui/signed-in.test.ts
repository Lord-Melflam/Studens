/**
 * Every screen behind a session actually renders.
 *
 * THIS TEST EXISTS BECAUSE TWO BUGS IN A ROW GOT PAST 350 OTHERS.
 *
 * On 2026-09-13 the app was shipped twice in a state François hit immediately
 * and no test could: first a redirect that made the whole app unreachable while
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
import { Shell, SessionProvider, Settings, FirstRun, bundle, type SessionState } from "@studens/web";

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
