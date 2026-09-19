/**
 * The renderer for the structured course fields.
 *
 * The parser producing correct blocks is checked in test/catalogue/rich.test.ts.
 * This checks the other half: that the blocks become the right elements. A
 * nested list that arrives nested and renders flat is the same bug to a reader,
 * and neither test alone would catch it.
 *
 * It also pins the property that makes this design worth its cost: no markup
 * from UCLouvain reaches the DOM. The parser produced a closed set of shapes
 * and the renderer builds our own elements from it, so there is no sanitiser
 * in the path and nothing to get wrong.
 */
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Blocks, FoldedField, ProseField, type Block } from "@studens/ryc-ui";

const html = (blocks: Block[]): string =>
  renderToStaticMarkup(createElement(Blocks, { blocks }));

/** Tags only, so an assertion reads as the shape rather than the styling. */
const shape = (s: string): string => s.replace(/<span[^>]*>|<\/span>/g, "").replace(/\s+/g, " ");

describe("blocks become elements", () => {
  it("a paragraph with two lines keeps the break", () => {
    expect(shape(html([{ kind: "p", lines: [[{ t: "un" }], [{ t: "deux" }]] }]))).toBe(
      "<p>un<br/>deux</p>",
    );
  });

  it("a nested list renders nested, not flattened", () => {
    const blocks: Block[] = [
      {
        kind: "list",
        ordered: false,
        items: [
          [
            { kind: "p", lines: [[{ t: "Examen" }]] },
            { kind: "list", ordered: false, items: [[{ kind: "p", lines: [[{ t: "6 questions" }]] }]] },
          ],
        ],
      },
    ];
    expect(shape(html(blocks))).toBe(
      "<ul><li><p>Examen</p><ul><li><p>6 questions</p></li></ul></li></ul>",
    );
  });

  it("an ordered list is an ol, so the browser supplies the numbers", () => {
    const blocks: Block[] = [
      { kind: "list", ordered: true, items: [[{ kind: "p", lines: [[{ t: "premier" }]] }]] },
    ];
    expect(shape(html(blocks))).toContain("<ol>");
    expect(shape(html(blocks))).not.toContain("1.");
  });

  it("emphasis flags become elements, in a fixed order", () => {
    const out = shape(html([{ kind: "p", lines: [[{ t: "x", b: true, i: true, c: true }]] }]));
    expect(out).toBe("<p><strong><em><code>x</code></em></strong></p>");
  });

  it("a table scrolls inside its own box rather than widening the page", () => {
    const out = html([{ kind: "table", rows: [["Examen", "60%"]] }]);
    expect(out).toContain('class="prose-table"');
    expect(shape(out)).toContain("<td>Examen</td><td>60%</td>");
  });

  it("an absent field renders nothing at all, not an empty section", () => {
    expect(renderToStaticMarkup(createElement(ProseField, { label: "Évaluation", blocks: null }))).toBe(
      "",
    );
    expect(
      renderToStaticMarkup(createElement(ProseField, { label: "Évaluation", blocks: [] })),
    ).toBe("");
  });
});

describe("nothing from the scraped page reaches the DOM as markup", () => {
  it("text that looks like HTML is escaped, because it is only ever text", () => {
    const out = html([{ kind: "p", lines: [[{ t: '<img src=x onerror="alert(1)">' }]] }]);
    expect(out).not.toContain("<img");
    expect(out).toContain("&lt;img");
    expect(out).not.toContain("onerror=\"");
  });

  it("a block kind the renderer does not know produces nothing, not a crash", () => {
    // The union makes this unreachable in typed code. It is reachable from a
    // Json column, which is why read.ts checks the shape and why this is here.
    const rogue = [{ kind: "script", src: "evil" }] as unknown as Block[];
    expect(() => html(rogue)).not.toThrow();
    expect(html(rogue)).not.toContain("evil");
  });
});

/**
 * A LONG FIELD STARTS FOLDED, so the reviews are not below a screenful of
 * catalogue prose.
 *
 * After the ULB crawl loaded, these fields turned out to be exhaustive enough
 * to take the whole screen on a course with a long description, pushing the
 * reviews far down the page. Seven prose fields on a ULB course, and the
 * reviews are the reason anyone opened it.
 */
describe("a folded field", () => {
  const blocks: Block[] = [{ kind: "p", lines: [[{ t: "un contenu assez long" }]] }];

  const fold = (open: boolean): string =>
    renderToStaticMarkup(
      createElement(FoldedField, { label: "Objectifs", blocks, open, onToggle: () => {} }),
    );

  it("shows its name and not its body when it is closed", () => {
    const out = fold(false);
    expect(out).toContain("Objectifs");
    expect(out).toContain('aria-expanded="false"');
    // Not hidden with CSS. A closed field on a long course holds hundreds of
    // elements, and seven of them is a page the browser lays out for nobody.
    expect(out).not.toContain("un contenu assez long");
  });

  it("shows its body when the caller says it is open", () => {
    // Open comes from the URL, so the component may not decide it: a field
    // that could close itself would drop a section named in the address.
    const out = fold(true);
    expect(out).toContain('aria-expanded="true"');
    expect(out).toContain("un contenu assez long");
  });

  it("is nothing at all when the field is empty", () => {
    // Same rule as ProseField: a heading that opens onto nothing is worse
    // than no heading.
    for (const empty of [null, []] as Array<Block[] | null>) {
      expect(
        renderToStaticMarkup(
          createElement(FoldedField, {
            label: "Objectifs",
            blocks: empty,
            open: true,
            onToggle: () => {},
          }),
        ),
      ).toBe("");
    }
  });
});
