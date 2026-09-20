/**
 * Appoint the first administrator. FR-E14.
 *
 *   npm run admin -- <username>
 *   npm run admin -- <username> --force    when an administrator already exists
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
 * `--force` IS THE WAY BACK, and it exists because administrators are peers.
 * `setRole` refuses only self demotion and removing the last administrator, so
 * with two of them each can demote the other. That is ordinary. What was not
 * ordinary is that the demoted one had no route left but editing a row by
 * hand, which is the state this file was written to remove.
 *
 * It grants nothing that was not already available: running it needs the
 * database, and anybody holding the database can write any row. The choice is
 * between a recorded, repeatable command and a silent UPDATE, so it is
 * recorded the same way, with the operator as the actor. FR-E17.
 *
 * IT DOES NOT CREATE AN ACCOUNT. Sign in first, finish the first run so the
 * account has a username, then run this. An account is made by signing in with
 * a provider, and inventing one here would mean a member with no identity
 * behind it.
 */
import { PrismaClient } from "@prisma/client";
import {
  AppointmentRefused,
  grantFirstAdmin,
  listAppointments,
  recoverAdmin,
} from "@studens/platform";
import { loadDotEnv } from "./env.js";

loadDotEnv();

const prisma = new PrismaClient();

function usage(): never {
  console.error("usage: npm run admin -- <username> [--force]");
  console.error("");
  console.error("Appoints the first administrator, once, by the username shown");
  console.error("on their account. Sign in and finish the first run first.");
  console.error("");
  console.error("--force appoints one even though another administrator exists.");
  console.error("It is the way back when an administrator was demoted by a peer,");
  console.error("and it is recorded in the audit log like every appointment.");
  process.exit(2);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const username = args.find((a) => !a.startsWith("-"));
  if (!username) usage();

  try {
    const appointed = force
      ? await recoverAdmin(prisma, username)
      : await grantFirstAdmin(prisma, username);
    console.log(`${appointed.username ?? appointed.memberId} is now an administrator.`);
    console.log("");
    console.log("Recorded in the audit log with the operator as the actor, because");
    console.log("no member made this appointment. Every later one names one.");
    if (force) {
      console.log("");
      console.log("Appointed with --force, past the check that there is already one.");
      console.log("Whoever else holds the role still holds it: this takes nothing away.");
    }
  } catch (err) {
    if (err instanceof AppointmentRefused && err.reason === "already-admin") {
      console.error(`Refused: "${username}" is already an administrator.`);
      process.exit(1);
    }
    if (err instanceof AppointmentRefused && err.reason === "admin-exists") {
      const who = await listAppointments(prisma);
      const admins = who.filter((a) => a.role === "admin").map((a) => a.username ?? a.memberId);
      console.error("Refused: there is already an administrator.");
      console.error(`Currently: ${admins.join(", ")}`);
      console.error("");
      console.error("Appoint anybody else from the moderation console, where the");
      console.error("appointment is recorded against the administrator who made it.");
      console.error("");
      console.error("If you have been demoted and cannot reach the console, this is");
      console.error("what --force is for.");
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
