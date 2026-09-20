import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    /*
      WHICH HOSTNAMES MAY REACH THE DEV SERVER, and why the list is empty by
      default.

      Vite refuses a request whose `Host` header it does not recognise, which
      is what stops somebody else's DNS name from being pointed at a
      developer's machine. Reaching this server through a tunnel means the
      browser sends the tunnel's hostname, so that name has to be named here
      or every request is answered with "Blocked request".

      It comes from the environment rather than being written in, because a
      tunnel hostname belongs to whoever is running the tunnel, not to the
      project, and because a vendor's domain in a tracked file would outlive
      the afternoon it was needed for. A leading dot means "this domain and
      its subdomains", which is what a tunnel hands out:

        STUDENS_DEV_HOST=.example-tunnel.dev npm run dev:web

      Comma separated for more than one.
    */
    allowedHosts: (process.env["STUDENS_DEV_HOST"] ?? "")
      .split(",")
      .map((h) => h.trim())
      .filter((h) => h !== ""),
    // The browser never talks to the catalogue directly. apps/web is an app
    // tier client of the API, and deliberately declares NO @studens workspace
    // dependency: @studens/ref is Node only (it reads files), and a browser
    // reaching module storage would break FR-B11 whatever the language.
    proxy: { "/api": "http://localhost:3001" },
  },
});
