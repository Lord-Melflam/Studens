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
import { Blocks, ProseField, type Block } from "@studens/ryc-ui";

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
