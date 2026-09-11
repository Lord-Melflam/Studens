/**
 * Load `.env`, on purpose, before anything reads it.
 *
 * This used to happen by accident: importing `@prisma/client` loads `.env` into
 * `process.env` as a side effect, so `DATABASE_URL` and everything beside it
 * arrived without anyone asking. Verified on 2026-09-12, and it works.
 *
 * It is still the wrong thing to depend on. If Prisma stops doing it, or an
 * import order changes so that a value is read before the client is loaded,
 * every STUDENS_ variable becomes absent at once and the symptom is an empty
 * provider list, which looks exactly like "the credentials are not configured
 * yet". An absence is invisible (LESSONS.md section 9), and this one would be
 * invisible in the authentication path.
 *
 * `process.loadEnvFile` is built into Node 20.12 and later, so this costs no
 * dependency. Values already in the real environment win, which is what a
 * deployment needs: there is no `.env` on the server, and there should not be.
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
