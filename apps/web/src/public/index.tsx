/**
 * The public zone: everything reachable without a session (FR-F2).
 *
 * An unknown public path renders the landing page rather than a 404 screen.
 * Deliberate for now: there is nothing here worth a dead end, and a stranger
 * who mistypes should land somewhere that explains the product.
 */
import { PublicLayout } from "./PublicLayout.js";
import { Landing } from "./Landing.js";
import { Modules } from "./Modules.js";
import { Privacy } from "./Privacy.js";
import { About } from "./About.js";
import { SignIn } from "./SignIn.js";
import { Suspended } from "./Suspended.js";

export function PublicZone({ path }: { path: string }) {
  const page =
    path === "/modules" ? (
      <Modules />
    ) : path === "/confidentialite" ? (
      <Privacy />
    ) : path === "/a-propos" ? (
      <About />
    ) : path === "/connexion" ? (
      <SignIn />
    ) : path === "/suspendu" ? (
      /* In the PUBLIC zone, because somebody suspended has no session and the
         app zone is exactly what they cannot reach. */
      <Suspended />
    ) : (
      <Landing />
    );

  return <PublicLayout path={path}>{page}</PublicLayout>;
}
