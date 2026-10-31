import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { cloudflare } from "@cloudflare/vite-plugin";

// Default `bun run build` produces a static SPA publish (Hostinger/Netlify-friendly):
// dist/client contains index.html + assets, and scripts/static-publish.mjs mirrors it to dist/ root.
// `bun run build:worker` sets BUILD_TARGET=worker to keep the SSR/Cloudflare output instead.
export default defineConfig({
  plugins: [
    // Router plugin must come before the TanStack Start plugin so route tree
    // generation happens before the Start plugin transforms routes.
    tanstackRouter({ target: "react", autoCodeSplitting: false }),
    viteReact(),
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    // BUILD_TARGET=worker → SSR/Cloudflare output; otherwise dev-only (static SPA has no dev server functions)
    ...(process.env.BUILD_TARGET === "worker" ? [cloudflare({ viteEnvironment: { name: "ssr" } })] : []),
    tanstackStart({
      server: { entry: "server" },
      spa: {
        enabled: process.env.BUILD_TARGET !== "worker",
        prerender: { enabled: process.env.BUILD_TARGET !== "worker" },
      },
    }),
  ],
});
