import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { cloudflare } from "@cloudflare/vite-plugin";

// Default `bun run build` produces a static SPA publish (Hostinger/Netlify-friendly):
// dist/client contains index.html + assets, and scripts/static-publish.mjs mirrors it to dist/ root.
// `bun run build:worker` sets BUILD_TARGET=worker to keep the SSR/Cloudflare output instead.
export default defineConfig({
  server: { port: 8080, strictPort: true },
  plugins: [
    // TanStack Start includes the router generator/code splitter, which must
    // run before JSX transformation.
    tanstackStart({
      server: { entry: "server" },
      spa: {
        enabled: process.env.BUILD_TARGET !== "worker",
        prerender: { enabled: process.env.BUILD_TARGET !== "worker" },
      },
    }),
    viteReact(),
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    ...(process.env.BUILD_TARGET === "worker"
      ? [cloudflare({ viteEnvironment: { name: "ssr" } })]
      : []),
  ],
});
