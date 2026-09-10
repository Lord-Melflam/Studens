// Deliberate FR-B10 violation. Not part of the build: eslint.config.js ignores
// test/fixtures, and boundaries.test.ts lints this file on purpose and asserts
// that it is rejected. If this file ever stops producing an error, the gate has
// been removed and the test fails.
import { tier } from "@studens/platform/src/index.js";
export const borrowed = tier;
