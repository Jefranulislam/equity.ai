// Builds the app as an SSR/Cloudflare Worker bundle (wrangler deploy path).
// Usage: npm run build:worker
import { spawnSync } from "node:child_process";

process.env.BUILD_TARGET = "worker";
const res = spawnSync("npx", ["vite", "build"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});
process.exit(res.status ?? 1);
