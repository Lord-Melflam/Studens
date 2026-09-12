/**
 * Every string in the product, merged.
 *
 * The shell's own, plus each module's. Built here rather than in `main.tsx` so
 * that a test can translate exactly what the running app translates: a test
 * with its own bundle would pass while the app showed raw keys.
 */
import { mergeBundles, type Bundle } from "@studens/i18n";
import { modules } from "./shell/registry.js";
import { shellStrings } from "./strings/index.js";

export const bundle: Bundle = mergeBundles(shellStrings, ...modules.map((m) => m.strings));
