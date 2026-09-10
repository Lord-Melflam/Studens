/**
 * A minimal hash router, deliberately not a dependency.
 *
 * The shell needs exactly one thing from a router: which module is mounted.
 * That is a dozen lines, and react-router would be a dependency and a decision
 * nothing yet justifies. If routing inside modules ever gets complicated, the
 * change is contained here, because no module imports this.
 */
import { useEffect, useState } from "react";

/** The module id in the URL, or null for the shell's home screen. */
export function currentModuleId(): string | null {
  const hash = window.location.hash.replace(/^#\/?/, "").split("/")[0] ?? "";
  return hash || null;
}

export function navigate(moduleId: string | null): void {
  window.location.hash = moduleId ? `/${moduleId}` : "/";
}

export function useRoute(): string | null {
  const [id, setId] = useState(currentModuleId);
  useEffect(() => {
    const onChange = () => setId(currentModuleId());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return id;
}
