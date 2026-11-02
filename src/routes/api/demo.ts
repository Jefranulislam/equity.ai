import { createFileRoute } from "@tanstack/react-router";
import { ensureDemoAccount } from "@/lib/demo.server";

export const Route = createFileRoute("/api/demo")({
  server: {
    handlers: {
      // Setup-only: creates the demo account and its seeded workspace.
      // Fail-closed: needs DEMO_ENABLED=true AND a matching DEMO_SETUP_TOKEN header.
      POST: async ({ request }) => {
        const expected = process.env.DEMO_SETUP_TOKEN;
        if (process.env.DEMO_ENABLED !== "true" || !expected) {
          return Response.json({ ok: false, error: "Not found" }, { status: 404 });
        }
        if (request.headers.get("x-demo-setup-token") !== expected) {
          return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        }
        try {
          await ensureDemoAccount();
          return Response.json({ ok: true });
        } catch (err) {
          console.error("[/api/demo]", err);
          return Response.json(
            { ok: false, error: err instanceof Error ? err.message : "Failed to prepare demo" },
            { status: 500 },
          );
        }
      },
    },
  },
});
