/**
 * The module registry.
 *
 * FR-B18: this is the ONLY place the shell learns that a module exists.
 * Adding MPA means adding one line here and nothing else, which is FR-B4
 * applied to the frontend.
 *
 * FR-B14: modules are imported, not loaded at runtime. There is no plugin
 * mechanism, because all module code lives in this repository and is reviewed
 * before merge.
 *
 * FR-B1 says a Member sees only the modules they are entitled to use. That
 * filtering is not here yet, because authentication is not built: see 3.2.
 */
import { rycModule, type ModuleRegistration, type ModulePresentation } from "@studens/ryc-ui";

export const modules: ModuleRegistration[] = [rycModule];

export type { ModuleRegistration, ModulePresentation };
