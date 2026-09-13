/**
 * Reading a programme's kind and site out of its title.
 *
 * The fixture below is the REAL list: all 43 programmes reachable from EPL in
 * 2025-2026, pasted from the database. A parser checked against titles somebody
 * invented is a parser checked against what the author expected the source to
 * look like, which is the failure the offering parser already produced once.
 *
 * The code suffixes (`1ba`, `2m`, `2mc`, `2fc`, `fil`, `mino`, `app`) are used
 * here as an INDEPENDENT cross-check, never as the source. They agree with the
 * titles today; if they ever stop agreeing, this fails and somebody looks.
 */
import { describe, expect, it } from "vitest";
import { programmeShape } from "@studens/ref";

const REAL: Array<[string, string]> = [
  ["appscvs", "Approfondissement en sciences du vivant et santé pour informaticiens (Charleroi)"],
  ["appsinf", "Approfondissement en sciences informatiques (Louvain-la-Neuve)"],
  ["coco7fc", "Attestation de réussite : complément pour coordinateur (Louvain-la-Neuve)"],
  ["cpht2fc", "Certificat d'université : Conseiller en prévention spécialisé en hygiène du travail (Louvain-la-Neuve)"],
  ["cppn2fc", "Certificat d'université : Conseiller en prévention de niveau 1 (Louvain-la-Neuve)"],
  ["cres2fc", "Certificat inter-universités : Systèmes embarqués critiques (Louvain-la-Neuve)"],
  ["cybe2fc", "Certificat d'université : Cybersécurité (Louvain-la-Neuve)"],
  ["cyse2m", "Master [120] en cybersécurité (Autre site)"],
  ["date2m", "Master [120] : ingénieur civil en science des données (Louvain-la-Neuve)"],
  ["dati2m", "Master [120] en science des données, orientation technologies de l'information (Louvain-la-Neuve)"],
  ["elec2m", "Master [120] : ingénieur civil électricien (Louvain-la-Neuve)"],
  ["elen2fc", "Certificat inter-universités : Electronique de l'énergie (Autre site)"],
  ["elme2m", "Master [120] : ingénieur civil électromécanicien (Louvain-la-Neuve)"],
  ["filelec", "Filière en Electricité (Louvain-la-Neuve)"],
  ["filfyki", "Filière en Chimie et physique appliquées (Louvain-la-Neuve)"],
  ["filgbio", "Filière en Génie Biomédical (Louvain-la-Neuve)"],
  ["filgce", "Filière en Construction (Louvain-la-Neuve)"],
  ["filinfo", "Filière en Informatique (Louvain-la-Neuve)"],
  ["filmap", "Filière en Mathématiques Appliquées (Louvain-la-Neuve)"],
  ["filmeca", "Filière en Mécanique (Louvain-la-Neuve)"],
  ["fsa1ba", "Bachelier en sciences de l'ingénieur, orientation ingénieur civil (Louvain-la-Neuve)"],
  ["fyap2m", "Master [120] : ingénieur civil physicien (Louvain-la-Neuve)"],
  ["gbio2m", "Master [120] : ingénieur civil biomédical (Louvain-la-Neuve)"],
  ["gce2m", "Master [120] : ingénieur civil des constructions (Louvain-la-Neuve)"],
  ["gnuc2mc", "Master de spécialisation en génie nucléaire (Autre site)"],
  ["info2m", "Master [120] : ingénieur civil en informatique (Louvain-la-Neuve)"],
  ["kima2m", "Master [120] : ingénieur civil en chimie et science des matériaux (Louvain-la-Neuve)"],
  ["lminoelec", "Mineure en Electricité (Louvain-la-Neuve)"],
  ["lminogce", "Mineure en Construction (Louvain-la-Neuve)"],
  ["lminomap", "Mineure en Mathématiques appliquées (Louvain-la-Neuve)"],
  ["lminomeca", "Mineure en Mécanique (Louvain-la-Neuve)"],
  ["map2m", "Master [120] : ingénieur civil en mathématiques appliquées (Louvain-la-Neuve)"],
  ["meca2m", "Master [120] : ingénieur civil mécanicien (Louvain-la-Neuve)"],
  ["mede2fc", "Certificat d'université : Clinical, regulatory and quality affairs for medical devices and in-vitro diagnostic (Louvain-la-Neuve)"],
  ["minofyki", "Mineure en Chimie et Physique Appliquées (Louvain-la-Neuve)"],
  ["minpoly", "Mineure Polytechnique (Louvain-la-Neuve)"],
  ["minsinf", "Mineure en sciences informatiques (Louvain-la-Neuve)"],
  ["nano2mc", "Master de spécialisation en nanotechnologies (Louvain-la-Neuve)"],
  ["nrgy2m", "Master [120] : ingénieur civil en génie de l'énergie (Louvain-la-Neuve)"],
  ["sinc1ba", "Bachelier en sciences informatiques (Charleroi)"],
  ["sinf1ba", "Bachelier en sciences informatiques (Louvain-la-Neuve)"],
  ["sinf2m", "Master [120] en sciences informatiques (Louvain-la-Neuve)"],
  ["sinf2m1", "Master [60] en sciences informatiques (Louvain-la-Neuve)"],
];

describe("every real programme classifies", () => {
  it("has the whole catalogue in the fixture", () => {
    expect(REAL).toHaveLength(43);
  });

  it("leaves none unrecognised", () => {
    const unknown = REAL.filter(([, title]) => programmeShape(title).kind === null);
    expect(
      unknown.map(([c, t]) => `${c}: ${t}`),
      "a title the parser does not know is shown as 'autre', which is safe but " +
        "means a whole group of programmes is unlabelled in the filter",
    ).toEqual([]);
  });

  it("finds a site for every one of them", () => {
    const siteless = REAL.filter(([, title]) => programmeShape(title).site === null);
    expect(siteless.map(([c]) => c)).toEqual([]);
  });

  it("agrees with the code suffixes, which it does not read", () => {
    const expected = (code: string): string | null => {
      if (code.endsWith("1ba")) return "bachelier";
      if (code.endsWith("2mc")) return "specialisation";
      if (code.endsWith("2m") || code.endsWith("2m1")) return "master";
      if (code.endsWith("fc")) return "certificat";
      if (code.startsWith("fil")) return "filiere";
      if (code.startsWith("mino") || code.startsWith("lmino") || code.startsWith("min"))
        return "mineure";
      if (code.startsWith("app")) return "approfondissement";
      return null;
    };
    const disagreements = REAL.map(([code, title]) => ({
      code,
      fromCode: expected(code),
      fromTitle: programmeShape(title).kind,
    })).filter((r) => r.fromCode !== null && r.fromCode !== r.fromTitle);
    expect(disagreements).toEqual([]);
  });

  it("counts the groups the database counts", () => {
    const tally: Record<string, number> = {};
    for (const [, title] of REAL) {
      const k = programmeShape(title).kind ?? "autre";
      tally[k] = (tally[k] ?? 0) + 1;
    }
    expect(tally).toEqual({
      master: 15,
      specialisation: 2,
      filiere: 7,
      mineure: 7,
      certificat: 7,
      bachelier: 3,
      approfondissement: 2,
    });
  });
});

describe("the parts of a title", () => {
  it("reads the credits of a master and nothing else's", () => {
    expect(programmeShape("Master [120] en sciences informatiques (Louvain-la-Neuve)").credits).toBe(120);
    expect(programmeShape("Master [60] en sciences informatiques (Louvain-la-Neuve)").credits).toBe(60);
    expect(programmeShape("Bachelier en sciences informatiques (Louvain-la-Neuve)").credits).toBeNull();
  });

  /** Order matters exactly once, and this is the case that proves it. */
  it("does not file a master of specialisation as a master", () => {
    expect(programmeShape("Master de spécialisation en génie nucléaire (Autre site)").kind).toBe(
      "specialisation",
    );
  });

  it("returns null rather than guessing at something new", () => {
    expect(programmeShape("Programme expérimental en quelque chose (Namur)").kind).toBeNull();
    // The site is still read, because that part did parse.
    expect(programmeShape("Programme expérimental en quelque chose (Namur)").site).toBe("Namur");
  });

  it("takes the site from the end, not from a parenthesis in the middle", () => {
    expect(
      programmeShape("Master [120] en sciences (biologie) appliquées (Charleroi)").site,
    ).toBe("Charleroi");
  });
});
