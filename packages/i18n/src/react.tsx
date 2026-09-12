/**
 * The React binding: a provider and a hook.
 *
 * Kept apart from the core so the core stays framework free and testable
 * without a renderer. React is a peer dependency here, as it is in ryc-ui.
 */
import { createContext, createElement, useContext, useMemo, type ReactNode } from "react";
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
          if (process.env["NODE_ENV"] !== "production") {
            console.warn(`i18n: missing "${key}" in ${missingIn}`);
          }
        },
      }),
    }),
    [locale, bundle],
  );
  return createElement(Ctx.Provider, { value }, children);
}

export function useT(): Translate {
  return useContext(Ctx).t;
}

export function useLocale(): Locale {
  return useContext(Ctx).locale;
}
