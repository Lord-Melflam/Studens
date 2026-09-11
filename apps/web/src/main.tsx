/**
 * The entry point, and the only place that decides which zone is showing.
 *
 * Two zones today: everything under /app needs a session, everything else is
 * public (FR-F1). The first-run sequence is the third and is not built yet.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Shell } from "./shell/Shell.js";
import { PublicZone } from "./public/index.js";
import { isAppPath, usePath } from "./router.js";
import "./shell.css";
import "./public/public.css";

function Studens() {
  const path = usePath();
  return isAppPath(path) ? <Shell /> : <PublicZone path={path} />;
}

const root = document.getElementById("root");
if (!root) throw new Error("no #root element");
createRoot(root).render(
  <StrictMode>
    <Studens />
  </StrictMode>,
);
