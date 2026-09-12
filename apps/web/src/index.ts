/**
 * What the web app exposes for testing.
 *
 * Not an entry point: `main.tsx` is, and it has side effects. This exists so
 * test/ui can import the public zone BY NAME, like every other package. The
 * FR-B6 rule forbids relative imports across workspace boundaries, correctly.
 */
export { PublicZone } from "./public/index.js";
export { Landing } from "./public/Landing.js";
export { PublicLayout } from "./public/PublicLayout.js";
export { currentPath, isAppPath, moduleIdFrom, linkProps, APP_PREFIX } from "./router.js";
export { modules, liveModules, presentModules, activeModuleFor } from "./shell/registry.js";
export { bundle } from "./bundle.js";
