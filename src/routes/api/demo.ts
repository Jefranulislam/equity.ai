import { createFileRoute } from "@tanstack/react-router";
import { ensureDemoSession } from "@/lib/demo.server";

export const Route = createFileRoute("/api/demo")({
  server: {
    handlers: {
      // One-click demo: provisions the demo account + seeded workspace, then
      // returns a one-time magic-link token for the browser to redeem.
      POST: async () => {
        try {
          const { tokenHash } = await ensureDemoSession();
          return Response.json({ ok: true, tokenHash });
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
