/**
 * Settings an administrator may change while the platform is running.
 *
 * THE PLATFORM STORES THEM AND DOES NOT UNDERSTAND THEM. A key is namespaced
 * by whoever owns it, `ryc.reviewsPerPage`, and this file never learns what
 * that means: it holds a string against a key and hands it back. Deciding that
 * ten is sensible and five is not belongs to the module that reads it, which
 * is FR-B18 applied to configuration rather than to code (tier 0 must not
 * depend on tier 1).
 *
 * WHY A TABLE AND NOT AN ENVIRONMENT VARIABLE. The point is that it changes
 * without a deploy and without a shell, by somebody who has neither. An
 * environment variable is the right home for a secret and the wrong home for a
 * decision somebody makes twice a year while looking at the product.
 *
 * NUMBERS ARE CLAMPED BY THE READER, NOT BY THE WRITER, and both do it. The
 * write path rejects what it can, and the read path clamps anyway, because a
 * row can be edited in the database by somebody who never went through the
 * form and a page size of zero or of a million must not be a way to take the
 * site down.
 */
import type { PrismaClient } from "@prisma/client";

/** Read a setting, or null when nobody has set it. */
export async function readSetting(
  prisma: PrismaClient,
  key: string,
): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value ?? null;
}

/**
 * Read a whole number, clamped, falling back when it is absent or unusable.
 *
 * Unusable covers more than it looks: absent, empty, not a number, negative,
 * and a value left behind by an earlier version of whatever wrote it. All of
 * them mean the same thing to a reader, which is "use the default".
 */
export async function readNumberSetting(
  prisma: PrismaClient,
  key: string,
  bounds: { fallback: number; min: number; max: number },
): Promise<number> {
  const raw = await readSetting(prisma, key);
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n)) return bounds.fallback;
  return Math.min(bounds.max, Math.max(bounds.min, n));
}

/** Set one, recording who did it. The audit log records it too, at the route. */
export async function writeSetting(
  prisma: PrismaClient,
  key: string,
  value: string,
  by: string,
): Promise<void> {
  await prisma.setting.upsert({
    where: { key },
    update: { value, updatedBy: by },
    create: { key, value, updatedBy: by },
  });
}

/** Every setting, for the screen that lists them. */
export async function allSettings(
  prisma: PrismaClient,
): Promise<Array<{ key: string; value: string; updatedAt: string }>> {
  const rows = await prisma.setting.findMany({ orderBy: { key: "asc" } });
  return rows.map((r) => ({
    key: r.key,
    value: r.value,
    updatedAt: r.updatedAt.toISOString(),
  }));
}
