/**
 * The structured course-page fields.
 *
 * These fixtures are the SHAPE of real UCLouvain markup, copied from the page
 * cache and reworded: run-on text separated by <br />, hand-typed "- " bullets,
 * nested <ul>, and <ol>. The catalogue-ingestion note requires fixtures that
 * are not tidier than the site, because a fixture tidier than reality is how
 * the crawl passed while finding zero courses (LESSONS.md section 1).
 */
import { describe, expect, it } from "vitest";
import * as cheerio from "cheerio";
import { richBlocks, blocksToText, type Block } from "@studens/ref";

function blocks(html: string): Block[] {
  const $ = cheerio.load(`<div id="v">${html}</div>`);
  const out = richBlocks($, $("#v")[0]!);
  expect(out).not.toBeNull();
  return out!;
}

/** A readable rendering, so an assertion reads like the screen. */
function render(bs: Block[], indent = ""): string[] {
  const lines: string[] = [];
  for (const b of bs) {
    if (b.kind === "p" || b.kind === "h") {
      const prefix = b.kind === "h" ? "## " : "";
      for (const line of b.lines) {
        lines.push(indent + prefix + line.map((s) => s.t).join(""));
      }
    } else if (b.kind === "list") {
      b.items.forEach((item, i) => {
        const [first, ...rest] = render(item, "");
        lines.push(indent + (b.ordered ? `${i + 1}. ` : "- ") + (first ?? ""));
        for (const r of rest) lines.push(indent + "  " + r);
        void rest;
      });
    } else {
      for (const row of b.rows) lines.push(indent + "| " + row.join(" | "));
    }
  }
  return lines;
}

describe("real markup keeps its structure", () => {
  it("reads <br /> as a line break instead of a space", () => {
    const out = blocks("Première ligne.<br />Deuxième ligne.<br />Troisième ligne.");
    expect(out).toHaveLength(1);
    expect(out[0]!.kind).toBe("p");
    expect(render(out)).toEqual(["Première ligne.", "Deuxième ligne.", "Troisième ligne."]);
  });

  it("keeps a nested <ul> nested", () => {
    const out = blocks(`Deux cotes :<br />
<ul><li>Examen écrit (12 points).
	<ul><li>six questions de théorie</li></ul>
	</li><li>Travail journalier (8 points)
	<ul><li>exercices à rendre</li><li>obligatoire</li></ul>
	</li></ul>
 Les deux doivent être réussies.<br />`);
    expect(render(out)).toEqual([
      "Deux cotes :",
      "- Examen écrit (12 points).",
      "  - six questions de théorie",
      "- Travail journalier (8 points)",
      "  - exercices à rendre",
      "  - obligatoire",
      "Les deux doivent être réussies.",
    ]);
  });

  it("keeps an <ol> ordered, because the numbers are the content", () => {
    const out = blocks("<ol><li>Relativité restreinte</li><li>Physique atomique</li></ol>");
    expect(render(out)).toEqual(["1. Relativité restreinte", "2. Physique atomique"]);
    const list = out[0]!;
    expect(list.kind === "list" && list.ordered).toBe(true);
  });

  it("keeps text before, between and after a list, in order", () => {
    const out = blocks("Avant.<ul><li>un</li></ul>Après.");
    expect(render(out)).toEqual(["Avant.", "- un", "Après."]);
  });

  it("keeps emphasis as flags, never as markup", () => {
    const out = blocks("Un <strong>examen</strong> et un <i>projet</i>.");
    const p = out[0]!;
    expect(p.kind).toBe("p");
    if (p.kind !== "p") return;
    const spans = p.lines[0]!;
    expect(spans.find((s) => s.t === "examen")?.b).toBe(true);
    expect(spans.find((s) => s.t === "projet")?.i).toBe(true);
    // Nothing carries a tag name or an angle bracket into the client.
    expect(JSON.stringify(out)).not.toMatch(/[<>]/);
  });

  it("keeps a table as rows rather than flattening it", () => {
    const out = blocks("<table><tr><td>Examen</td><td>60%</td></tr><tr><td>Projet</td><td>40%</td></tr></table>");
    expect(render(out)).toEqual(["| Examen | 60%", "| Projet | 40%"]);
  });
});

describe("hand-typed bullets, the other convention on these pages", () => {
  it("promotes a run of typed bullets to a real list", () => {
    const out = blocks(
      "Le cours couvre :<br />- les ondes<br />- la relativité<br />- la structure atomique",
    );
    expect(render(out)).toEqual([
      "Le cours couvre :",
      "- les ondes",
      "- la relativité",
      "- la structure atomique",
    ]);
    expect(out[1]!.kind).toBe("list");
  });

  it("leaves a single hyphenated line alone, because one bullet is a dash", () => {
    const out = blocks("Interaction rayonnement-matière.<br />- voir le syllabus");
    // Two lines, one paragraph, no list: a run of one proves nothing.
    expect(out).toHaveLength(1);
    expect(out[0]!.kind).toBe("p");
    expect(render(out)).toEqual(["Interaction rayonnement-matière.", "- voir le syllabus"]);
  });

  it("returns to plain lines after the run ends", () => {
    const out = blocks("- un<br />- deux<br />Puis une phrase normale.");
    expect(out.map((b) => b.kind)).toEqual(["list", "p"]);
    expect(render(out)).toEqual(["- un", "- deux", "Puis une phrase normale."]);
  });

  it("strips the marker from the item text", () => {
    const out = blocks("- premier<br />- deuxième");
    const list = out[0]!;
    if (list.kind !== "list") throw new Error("expected a list");
    expect(blocksToText(list.items[0]!)).toBe("premier");
  });
});

describe("what the parser refuses to invent", () => {
  it("an empty value is null, not an empty block", () => {
    const $ = cheerio.load(`<div id="v">   <br />  </div>`);
    expect(richBlocks($, $("#v")[0]!)).toBeNull();
  });

  it("drops the destination of a link but keeps its text", () => {
    const out = blocks('Voir <a href="https://example.org/x">le site</a> du cours.');
    expect(blocksToText(out)).toBe("Voir le site du cours.");
    expect(JSON.stringify(out)).not.toContain("example.org");
  });
});
