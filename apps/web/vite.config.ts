import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // The browser never talks to the catalogue directly. apps/web is an app
    // tier client of the API, and deliberately declares NO @studens workspace
    // dependency: @studens/ref is Node only (it reads files), and a browser
    // reaching module storage would break FR-B11 whatever the language.
    proxy: { "/api": "http://localhost:3001" },
  },
});
