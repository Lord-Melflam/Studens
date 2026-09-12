/**
 * Translation, in about eighty lines and no dependency.
 *
 * REJECTED: i18next and friends. Their real value is extraction tooling and a
 * plural engine, and the platform already ships the plural engine as
 * `Intl.PluralRules`. What is left is a dictionary lookup and a string
 * substitution, which is this file. The project has made the same call about
 * react-router and about an OIDC client, for the same reason: a dependency is
 * a thing to understand, update and be exposed by, and it should be earning
 * more than sixty lines.
 *
 * WHAT WOULD CHANGE IT: plural categories beyond `one` and `other` (Polish,
 * Arabic, Russian all need more), or translators who want to work in `.po`
 * files rather than in the repository. Neither applies to French, Dutch and
 * English.
 *
 * MISSING KEYS ARE LOUD, not silent. A key absent from Dutch falls back to
 * French, which is the right behaviour for a reader and the wrong behaviour
 * for everyone else: nobody ever notices a page that quietly reverts. So the
 * fallback is reported to `onMissing`, the development build throws, and
 * test/i18n asserts that every locale carries every key.
 */
import { DEFAULT_LOCALE, LOCALES, type Locale } from "./locale.js";

/** Flat, so a key is greppable: `public.hero.title`, not a nested object. */
export type Catalog = Readonly<Record<string, string>>;
export type Bundle = Readonly<Record<Locale, Catalog>>;

export type Vars = Readonly<Record<string, string | number>>;

export interface TranslatorOptions {
  /** Called when a key is missing from the requested locale. */
  onMissing?: (key: string, locale: Locale) => void;
}

export type Translate = (key: string, vars?: Vars) => string;

const PLACEHOLDER = /\{(\w+)\}/g;

function interpolate(template: string, vars: Vars | undefined): string {
  if (!vars) return template;
  return template.replace(PLACEHOLDER, (whole, name: string) => {
    const value = vars[name];
    return value === undefined ? whole : String(value);
  });
}

/**
 * Pick the plural form for a count.
 *
 * A key `x` with a `count` variable looks for `x.one` and `x.other` before
 * falling back to `x`. `Intl.PluralRules` decides which, per locale, which is
 * why this does not hard-code "1 is singular": French treats 0 as singular and
 * English does not, and that is exactly the kind of thing a hand-written rule
 * gets wrong.
 */
function pluralKey(key: string, locale: Locale, catalog: Catalog, vars?: Vars): string {
  if (!vars || typeof vars["count"] !== "number") return key;
  const form = new Intl.PluralRules(locale).select(vars["count"]);
  const candidate = `${key}.${form}`;
  if (candidate in catalog) return candidate;
  const other = `${key}.other`;
  return other in catalog ? other : key;
}

export function createTranslator(
  bundle: Bundle,
  locale: Locale,
  opts: TranslatorOptions = {},
): Translate {
  const catalog = bundle[locale] ?? bundle[DEFAULT_LOCALE];
  const fallback = bundle[DEFAULT_LOCALE];

  return (key, vars) => {
    const resolved = pluralKey(key, locale, catalog, vars);
    const hit = catalog[resolved];
    if (hit !== undefined) return interpolate(hit, vars);

    opts.onMissing?.(key, locale);
    const fallbackKey = pluralKey(key, DEFAULT_LOCALE, fallback, vars);
    const spare = fallback[fallbackKey];
    // The key itself, never an empty string: a blank space in a page is
    // invisible, and a key on screen is a bug report from the product.
    return spare === undefined ? key : interpolate(spare, vars);
  };
}

/** Merge catalogs from several packages into one bundle, locale by locale. */
export function mergeBundles(...bundles: Bundle[]): Bundle {
  const out = {} as Record<Locale, Record<string, string>>;
  for (const locale of LOCALES) {
    out[locale] = {};
    for (const bundle of bundles) Object.assign(out[locale], bundle[locale] ?? {});
  }
  return out;
}

/**
 * Every key in every locale, for the gate in test/i18n.
 *
 * Returns what is missing rather than a boolean, because "Dutch is missing
 * eleven keys and here they are" is actionable and "false" is not.
 */
export function missingKeys(bundle: Bundle): Array<{ locale: Locale; key: string }> {
  const every = new Set<string>();
  for (const locale of LOCALES) for (const k of Object.keys(bundle[locale] ?? {})) every.add(k);

  const gaps: Array<{ locale: Locale; key: string }> = [];
  for (const locale of LOCALES) {
    const catalog = bundle[locale] ?? {};
    for (const key of every) {
      // A plural variant is only required where the base key has variants in
      // the source language, so absence of `x.one` in a locale that does not
      // need it is not a gap.
      if (!(key in catalog)) gaps.push({ locale, key });
    }
  }
  return gaps;
}
