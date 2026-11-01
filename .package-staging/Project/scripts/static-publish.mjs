// Mirrors the SPA build output (dist/client) into dist/ root so static hosts
// (e.g. Hostinger with output directory "dist") find index.html and assets.
//
// TanStack Start SPA mode emits:
//   - dist/client/index.html     when the root route is fully prerendered, or
//   - dist/client/_shell.html    as the app-shell fallback when it is not.
// Static hosts expect index.html at the root, so we fall back to the shell
// and also copy .htaccess for Apache/Hostinger to rewrite deep links (/login,
// /invoices/123, ...) to the SPA entry.
import { cpSync, existsSync, copyFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CLIENT = "dist/client";

let entry = join(CLIENT, "index.html");
if (!existsSync(entry)) {
  const shell = join(CLIENT, "_shell.html");
  if (existsSync(shell)) {
    copyFileSync(shell, entry);
    console.log("[static-publish] no index.html prerendered — promoted _shell.html to index.html.");
  } else {
    console.error(
      "[static-publish] dist/client/index.html not found — run `npm run build` first.",
    );
    process.exit(0); // don't fail SSR-only builds that legitimately produce no index.html
  }
}

// Apache/Hostinger: rewrite every non-asset path to the SPA entry so client-side
// routing works on deep links. Serve cached assets as-is, never rewrite them.
const HTACCESS = `<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /

  # Serve existing files/directories as-is
  RewriteCond %{REQUEST_URI} -f [OR]
  RewriteCond %{REQUEST_URI} -d
  RewriteRule ^ - [L]

  # Everything else goes to the SPA entry point
  RewriteRule ^ /index.html [L]
</IfModule>

# Long cache for fingerprinted assets
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType text/javascript "access plus 1 year"
  ExpiresByType text/css "access plus 1 year"
  ExpiresByType image/svg+xml "access plus 1 year"
</IfModule>
`;
writeFileSync(join("dist", ".htaccess"), HTACCESS, "utf8");

cpSync(CLIENT, "dist", { recursive: true });
console.log("[static-publish] copied dist/client \u2192 dist/ root for static hosting.");
