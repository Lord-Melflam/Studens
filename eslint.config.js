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
