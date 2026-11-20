import { createFileRoute } from "@tanstack/react-router";
import { ensureDemoAccount } from "@/lib/demo.server";

/** Constant-time string comparison (avoids leaking the token via timing). */
function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  const len = Math.max(x.length, y.length);
  for (let i = 0; i < len; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export const Route = createFileRoute("/api/demo")({
  server: {
    handlers: {
      // Setup-only: creates the demo account and its seeded workspace.
      // Fail-closed in every environment: the route answers 404 unless
      // DEMO_ENABLED=true AND DEMO_SETUP_TOKEN (>= 16 chars) are both set, and
      // 401 unless the x-demo-setup-token header matches (constant-time).
      // Leave DEMO_ENABLED unset in production once the demo is seeded.
      POST: async ({ request }) => {
        const expected = process.env.DEMO_SETUP_TOKEN ?? "";
        if (process.env.DEMO_ENABLED !== "true" || expected.length < 16) {
          return Response.json({ ok: false, error: "Not found" }, { status: 404 });
        }
        if (!safeEqual(request.headers.get("x-demo-setup-token") ?? "", expected)) {
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
