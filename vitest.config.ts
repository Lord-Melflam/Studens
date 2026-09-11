import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const src = (pkg: string) =>
  fileURLToPath(new URL(`./packages/${pkg}/src/index.ts`, import.meta.url));

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    /**
     * Tests import modules BY NAME, the same way application code does, so the
     * FR-B10 boundary rule applies to them too and they exercise the public
     * entry point rather than reaching into src. These aliases resolve those
     * names to source so the tests need no build step.
     *
     * The useful side effect: if a module stops exporting something its own
     * tests need, the tests fail. That is the module contract being checked
     * rather than assumed.
     */
    alias: {
      "@studens/platform": src("platform"),
      "@studens/ref": src("ref"),
      "@studens/ryc": src("ryc"),
      // The API, so a test can stand the real app up over HTTP rather than
      // reimplementing its routing. Resolved to source like the rest, so the
      // test exercises what is written and not what was last built.
      "@studens/api": fileURLToPath(new URL("./apps/api/src/index.ts", import.meta.url)),
      // The frontend module's entry point is .tsx, hence the explicit path.
      "@studens/ryc-ui": fileURLToPath(
        new URL("./packages/ryc-ui/src/index.tsx", import.meta.url),
      ),
    },
  },
});
