/**
 * Appoint the first administrator. FR-E14.
 *
 *   npm run admin -- <username>
 *
 * WHY A COMMAND AND NOT A SCREEN. Every appointment in the product needs an
 * administrator to make it, so the first one cannot happen there: a fresh
 * install has nobody who can appoint anybody and the console stays unreachable.
 * A route that promotes somebody while no administrator exists would be open to
 * whoever reached it first, and registration is public (FR-A6), so that is a
 * stranger. Reaching the database is the check, because that is the one
 * capability the person who installed this has and nobody else does.
 *
 * IT WORKS ONCE. With an administrator in place it refuses, and appointment
 * goes back through the console where an administrator is named in the audit
 * entry. This is not a way around FR-E14, it is the hole FR-E14 leaves at the
 * start.
 *
 * IT DOES NOT CREATE AN ACCOUNT. Sign in first, finish the first run so the
 * account has a username, then run this. An account is made by signing in with
 * a provider, and inventing one here would mean a member with no identity
 * behind it.
 */
import { PrismaClient } from "@prisma/client";
import { AppointmentRefused, grantFirstAdmin, listAppointments } from "@studens/platform";
import { loadDotEnv } from "./env.js";

loadDotEnv();

const prisma = new PrismaClient();

function usage(): never {
  console.error("usage: npm run admin -- <username>");
  console.error("");
  console.error("Appoints the first administrator, once, by the username shown");
  console.error("on their account. Sign in and finish the first run first.");
  process.exit(2);
}

async function main(): Promise<void> {
  const username = process.argv[2];
  if (!username || username.startsWith("-")) usage();

  try {
    const appointed = await grantFirstAdmin(prisma, username);
    console.log(`${appointed.username ?? appointed.memberId} is now an administrator.`);
    console.log("");
    console.log("Recorded in the audit log with the operator as the actor, because");
    console.log("no member made this appointment. Every later one names one.");
  } catch (err) {
    if (err instanceof AppointmentRefused && err.reason === "admin-exists") {
      const who = await listAppointments(prisma);
      const admins = who.filter((a) => a.role === "admin").map((a) => a.username ?? a.memberId);
      console.error("Refused: there is already an administrator.");
      console.error(`Currently: ${admins.join(", ")}`);
      console.error("");
      console.error("Appoint anybody else from the moderation console, where the");
      console.error("appointment is recorded against the administrator who made it.");
      process.exit(1);
    }
    if (err instanceof AppointmentRefused && err.reason === "unknown-member") {
      console.error(`Refused: no account has the username "${username}".`);
      console.error("");
      console.error("It is the username chosen during the first run, not an email");
      console.error("address and not a provider account name.");
      process.exit(1);
    }
    throw err;
  }
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
