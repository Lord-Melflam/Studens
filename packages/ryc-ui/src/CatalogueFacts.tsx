/**
 * What the catalogue holds, read from the catalogue.
 *
 * This replaced three translated strings: "UCLouvain", "546 cours",
 * "43 programmes". Every one of them was false by the time anybody read it,
 * because the crawl had widened to two universities and twenty times the
 * courses and nothing updates a sentence. François, seeing it: "the main page
 * is stale, still talk uclouvain only ... you see why it would have been
 * interesting to have global variable?" He is right, and the version of that
 * which cannot rot is to fetch the numbers rather than to keep them anywhere.
 *
 * OWNED BY THE MODULE, like the mock beside it. The public zone places this
 * and never reads it, because what a module's catalogue contains is the
 * module's vocabulary and FR-B16 keeps that out of the shell.
 *
 * It renders nothing at all until the numbers arrive, and nothing at all if
 * they never do. A marketing page that says "0 cours" because a request failed
 * is worse than one that says nothing.
 */
import { useEffect, useState } from "react";
import { useLocale, useT } from "@studens/i18n";
import { api } from "./api.js";

export function CatalogueFacts() {
  const t = useT();
  const locale = useLocale();
  const [facts, setFacts] = useState<{
    year: number;
    courses: number;
    programmes: number;
    institutions: string[];
  } | null>(null);

  useEffect(() => {
    let live = true;
    api
      .catalogue()
      .then((c) => live && setFacts(c))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  if (!facts) return null;

  // Grouped by the reader's locale: "12 093" in French and Dutch, "12,093" in
  // English. Five digits run together read as a serial number.
  const n = (x: number): string => new Intl.NumberFormat(locale).format(x);

  return (
    <ul className="chips">
      {/* The universities by name, however many there are. Naming one was the
          bug; hardcoding two would be the same bug a year later. */}
      {facts.institutions.map((code) => (
        <li key={code}>{code.toUpperCase()}</li>
      ))}
      <li>{t("ryc.sources.courses", { n: n(facts.courses) })}</li>
      <li>{t("ryc.sources.programmes", { n: n(facts.programmes) })}</li>
      <li>{t("ryc.sources.year", { from: facts.year, to: facts.year + 1 })}</li>
    </ul>
  );
}
