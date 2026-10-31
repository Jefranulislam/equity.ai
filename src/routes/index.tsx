import { createFileRoute } from "@tanstack/react-router";
import Landing from "@/components/landing";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Equity.AI — AI-powered ERP & Accounting for SMBs" },
      {
        name: "description",
        content:
          "Invoices, payments, inventory, bills and double-entry accounting in one unified workspace — with Freya, an AI accountant grounded in your live ledger. Free while in beta, with a one-click demo.",
      },
    ],
    scripts: [
      {
        // Inter Tight for display headings (Inter is loaded app-wide already)
        src: "https://fonts.googleapis.com/css2?family=Inter+Tight:wght@600;700;800&display=swap",
        type: "stylesheet",
        defer: true,
      },
    ],
  }),
  component: Landing,
});
