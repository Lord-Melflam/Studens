/**
 * The filter panel, after the rebuild of 2026-09-18.
 *
 * François, on the version before it: "too many groups stacked (or not
 * properly separated), and the long ones hidden behind 'choose from'. And it's
 * ugly." Three of those four are visual and a test cannot hold them. The
 * fourth is not: a group of 20 faculties that opens folded is a filter the
 * reader has to find before they can use it, and that is a rule.
 *
 * So these check the behaviour the look was chosen to serve: every group
 * starts open, a long one turns into rows with a search box instead of a field
 * of pills, and the scope line says which catalogues you are reading.
 */
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nProvider } from "@studens/i18n";
import { FilterGroup, ScopePicker, rycStrings } from "@studens/ryc-ui";
import type { ReactNode } from "react";

function draw(children: ReactNode): string {
  return renderToStaticMarkup(
    createElement(I18nProvider, { locale: "fr", bundle: rycStrings, children }),
  );
}

/** `n` options, named so a search for one of them matches exactly one. */
function facets(n: number): Array<{ value: string; label: string; count: number }> {
  return Array.from({ length: n }, (_, i) => ({
    value: `v${i}`,
    label: `Option ${i}`,
    count: n - i,
  }));
}

const SHORT = facets(6);
const LONG = facets(20);

describe("a filter group", () => {
  it("starts open, however many options it has", () => {
    // The whole point of the rebuild. A group that opens folded is the
    // "choose from 31" it replaced, wearing a chevron.
    for (const options of [SHORT, LONG]) {
      const html = draw(
        createElement(FilterGroup, {
          legend: "Faculte",
          facets: options,
          chosen: [],
          onToggle: () => undefined,
        }),
      );
      expect(html).toContain('aria-expanded="true"');
      expect(html).toContain("Option 0");
    }
  });

  it("draws a short group as chips and a long one as rows", () => {
    const short = draw(
      createElement(FilterGroup, {
        legend: "Site",
        facets: SHORT,
        chosen: [],
        onToggle: () => undefined,
      }),
    );
    expect(short).toContain('class="chipset"');
    expect(short).not.toContain("optlist");
    // No search box over six options: it would cost a line and save nothing.
    expect(short).not.toContain("group-search");

    const long = draw(
      createElement(FilterGroup, {
        legend: "Faculte",
        facets: LONG,
        chosen: [],
        onToggle: () => undefined,
      }),
    );
    expect(long).toContain('class="optlist"');
    expect(long).toContain("group-search");
    // One line each, so the full text has to be reachable some other way.
    expect(long).toContain('title="Option 0"');
  });

  it("is not drawn at all when there is nothing to choose between", () => {
    const html = draw(
      createElement(FilterGroup, {
        legend: "Langue",
        facets: facets(1),
        chosen: [],
        onToggle: () => undefined,
      }),
    );
    expect(html).toBe("");
  });

  it("says what is chosen in the header, not only in the body", () => {
    const html = draw(
      createElement(FilterGroup, {
        legend: "Site",
        facets: SHORT,
        chosen: ["v2"],
        onToggle: () => undefined,
      }),
    );
    // Folded or scrolled past, the header is the only thing still on screen.
    expect(html).toContain("Option 2");
    expect(html).toContain("group-state");
  });
});

describe("the scope line", () => {
  it("names the member's universities rather than all of them", () => {
    const html = draw(
      createElement(ScopePicker, {
        all: ["uclouvain", "ulb"],
        mine: ["ulb"],
        onAdd: () => undefined,
        onRemove: () => undefined,
      }),
    );
    expect(html).toContain("ULB");
    // Closed, it is a statement of what you are reading, not a list of
    // everything you are not.
    expect(html).not.toContain("UCLOUVAIN");
  });

  it("names both when both are held", () => {
    // FR-F: a member following courses at two universities is the case that
    // made /bienvenue/5 a multiple choice.
    const html = draw(
      createElement(ScopePicker, {
        all: ["uclouvain", "ulb"],
        mine: ["uclouvain", "ulb"],
        onAdd: () => undefined,
        onRemove: () => undefined,
      }),
    );
    expect(html).toContain("UCLOUVAIN");
    expect(html).toContain("ULB");
  });

  it("is absent when it could only ever do nothing", () => {
    const html = draw(
      createElement(ScopePicker, {
        all: ["uclouvain"],
        mine: ["uclouvain"],
        onAdd: () => undefined,
        onRemove: () => undefined,
      }),
    );
    expect(html).toBe("");
  });
});
