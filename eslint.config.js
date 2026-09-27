// FR-B6: violations of the module boundary fail the build, rather than relying
// on reviewer vigilance. FR-B15: this holds regardless of who wrote the change,
// including the project owner, because a gate the author can bypass is not a
// control.
//
// Two complementary mechanisms, deliberately:
//   1. Dependency DIRECTION is checked from the workspace manifests, in
//      test/architecture/boundaries.test.ts. A package that does not declare a
//      dependency cannot resolve it, so that check is stronger than lint.
//   2. Deep imports are checked here, because a manifest cannot catch them:
//      importing @studens/platform/src/internals resolves fine and still
//      breaks the boundary.

import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

const deepImportBan = {
  patterns: [
    {
      group: ["@studens/*/src/**", "@studens/*/dist/**"],
      message:
        "Reach a module only through its public entry point (FR-B2, FR-B10). Deep imports bypass the module contract.",
    },
    {
      group: ["../../packages/*", "../../../packages/*", "../../apps/*"],
      message:
        "Import workspace packages by name (@studens/...), not by relative path. Relative paths escape the boundary checks.",
    },
  ],
};

export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**", "test/fixtures/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: { "no-restricted-imports": ["error", deepImportBan] },
  },
  {
    /*
      THE RULES OF HOOKS, ENFORCED RATHER THAN REMEMBERED.

      Added 2026-09-27, after every programme page crashed. `CourseFilters`
      declared a `useState` BELOW an early return: a render with no courses
      called four hooks and the next one, once they had loaded, called five.
      React refuses that and the error boundary replaced the page with
      "Rendered more hooks than during the previous render", which says nothing
      about which component or which hook.

      Nothing in the toolchain saw it. TypeScript is happy, the tests are happy
      because they do not render that component through both states, and the
      bug only appears on the second render of a page that loads its data
      asynchronously, which is every page here.

      This is the one class of React mistake that is both mechanical to detect
      and fatal to the page, which is why a dev dependency is warranted where
      the project otherwise refuses them (CON-1). It is lint only: nothing
      ships from it.
    */
    files: ["**/*.tsx"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      /*
        OFF, DELIBERATELY, AND IT IS THE WEAKER HALF OF THIS PLUGIN.

        `rules-of-hooks` above catches a mistake that is always a bug and
        always fatal: the page is replaced by an error boundary. This one is
        advisory, and on this codebase it reports seven things, none of which
        is a known defect:

          - `t`, the translation function, in three fetch effects. Adding it
            would re-run a fetch whenever the language changes, which is a
            heavier change than the stale error message it would fix.
          - `navigate`, which is a PROP here rather than a module function, so
            adding it re-runs the effect whenever the parent re-renders unless
            the parent memoises it. That is an audit of the parent, not a
            one-line fix.
          - `route` and `openCode`, both read once on purpose.

        Seven permanent warnings is how a lint gate gets ignored, and an
        ignored gate is worse than an absent one because it looks like
        coverage. Turning them into errors would mean seven silencing comments
        that each say less than the code around them already does.

        WHAT WOULD CHANGE THIS: memoising `navigate` at its source, which would
        remove two of the seven and make the rest worth reading.
      */
      "react-hooks/exhaustive-deps": "off",
    },
  },
  {
    // Plain Node scripts run by hand or by CI, not part of any deployable.
    // The globals are listed rather than pulled from the `globals` package: a
    // dependency for four names is not worth the supply chain (CON-1's habit,
    // applied to dev dependencies too).
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
        URL: "readonly",
        Buffer: "readonly",
      },
    },
  },
  {
    // Tier 1 depends on nothing.
    files: ["packages/platform/**/*.ts", "packages/platform/**/*.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            ...deepImportBan.patterns,
            {
              group: ["@studens/ref", "@studens/ryc", "@studens/*"],
              message:
                "platform is tier 1 and depends on nothing (FR-B10). Dependencies point down, never up or sideways.",
            },
          ],
        },
      ],
    },
  },
  {
    // Tier 2 depends on nothing.
    files: ["packages/ref/**/*.ts", "packages/ref/**/*.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            ...deepImportBan.patterns,
            {
              group: ["@studens/*"],
              message:
                "ref is a reference module and depends on nothing (FR-B10). It is read by feature modules, not the reverse.",
            },
          ],
        },
      ],
    },
  },
);
