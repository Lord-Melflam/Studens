/**
 * Load `.env` before anything reads it.
 *
 * The same fifteen lines as `apps/api/src/env.ts`, and deliberately not shared.
 * These are two deployables, an app may not import another app (FR-B6, and
 * `test/architecture/boundaries.test.ts` enforces it), and putting process
 * bootstrap into a package would make a library responsible for how a process
 * starts. Fifteen duplicated lines is the cheaper of the two wrongs.
 *
 * Until now the worker got its variables by accident: importing
 * `@prisma/client` loads `.env` as a side effect. That works and is still the
 * wrong thing to rely on, for the reason written out in the API's copy.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";

let loaded = false;

export function loadDotEnv(cwd: string = process.cwd()): "loaded" | "absent" | "unsupported" {
  if (loaded) return "loaded";
  const path = resolve(cwd, ".env");
  if (!existsSync(path)) return "absent";
  if (typeof process.loadEnvFile !== "function") return "unsupported";
  process.loadEnvFile(path);
  loaded = true;
  return "loaded";
}
