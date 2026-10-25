// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
// Default `npm run build` produces a static SPA publish (Hostinger/Netlify-friendly):
// dist/client contains index.html + assets, and scripts/static-publish.mjs mirrors it to dist/ root.
// `npm run build:worker` sets BUILD_TARGET=worker to keep the SSR/Cloudflare output instead.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
    ...(process.env.BUILD_TARGET === "worker"
      ? {}
      : { spa: { enabled: true, prerender: { enabled: true } } }),
  },
});
