/**
 * Internationalisation (FR-G).
 *
 * Three languages, the locale in the path, catalogs owned by the package that
 * renders the strings. See docs/design/internationalisation.md.
 */
export {
  LOCALES,
  DEFAULT_LOCALE,
  LOCALE_NAMES,
  isLocale,
  splitLocale,
  localePath,
  preferredLocale,
  type Locale,
} from "./locale.js";

export {
  createTranslator,
  mergeBundles,
  missingKeys,
  type Bundle,
  type Catalog,
  type Translate,
  type Vars,
} from "./translate.js";

export { I18nProvider, useT, useLocale } from "./react.js";
