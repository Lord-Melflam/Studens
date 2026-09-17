/**
 * The React binding: a provider and a hook.
 *
 * Kept apart from the core so the core stays framework free and testable
 * without a renderer. React is a peer dependency here, as it is in ryc-ui.
 */
import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { DEFAULT_LOCALE, type Locale } from "./locale.js";
import { createTranslator, type Bundle, type Translate } from "./translate.js";

interface Value {
  locale: Locale;
  t: Translate;
}

const Ctx = createContext<Value>({
  locale: DEFAULT_LOCALE,
  // A component rendered outside a provider gets its key back rather than a
  // crash or a blank. Visible, harmless, and obviously wrong on screen.
  t: (key) => key,
});

export function I18nProvider({
  locale,
  bundle,
  children,
}: {
  locale: Locale;
  bundle: Bundle;
  children: ReactNode;
}) {
  const value = useMemo<Value>(
    () => ({
      locale,
      t: createTranslator(bundle, locale, {
        onMissing: (key, missingIn) => {
          // Loud where it can be fixed, silent where it cannot. In production
          // a reader gets the French and no console noise; in development the
          // person who forgot the Dutch hears about it immediately.
          //
          // GUARDED, BECAUSE `process` DOES NOT EXIST IN A BROWSER. This ran
          // only when a key was missing, so the one path meant to soften a
          // missing string was the path that threw: the translator raised
          // `ReferenceError: process is not defined` and the error boundary
          // replaced the whole page. A missing word became a blank screen.
          //
          // Vite does replace `process.env.NODE_ENV` at build time, but only in
          // that exact spelling; the bracket form here survived into the bundle
          // untouched. A `typeof` check needs no bundler cooperation and is
          // right in Node too, where these strings are also rendered by tests.
          if (typeof process === "undefined" || process.env["NODE_ENV"] !== "production") {
            console.warn(`i18n: missing "${key}" in ${missingIn}`);
          }
        },
      }),
    }),
    [locale, bundle],
  );
  /**
   * `<html lang>` says which language the document is in, and it was wrong on
   * two pages in three.
   *
   * `index.html` is one file for all three languages and ships `lang="fr"`
   * hardcoded, because that is what Vite's template had. Nothing ever changed
   * it, so an English page told every screen reader to pronounce it as French,
   * and told every translation tool it did not need translating.
   *
   * Here because this is the one component that knows the active language, and
   * the attribute is the document-level statement of exactly that. In an effect
   * because it touches the document: nothing runs during a static render, which
   * is how the tests draw these components.
   */
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = locale;
  }, [locale]);

  return createElement(Ctx.Provider, { value }, children);
}

export function useT(): Translate {
  return useContext(Ctx).t;
}

export function useLocale(): Locale {
  return useContext(Ctx).locale;
}
