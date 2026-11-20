// Unit tests for pure business helpers. Run with: bun test
import { describe, expect, test } from "bun:test";
import { computeDashboardKpis } from "../src/lib/kpis";
import { joinById } from "../src/lib/relations";
import { statusTone, STATUS_TONE } from "../src/lib/status-styles";

describe("computeDashboardKpis", () => {
  const today = "2026-06-15";
  const invoices = [
    { total: 100, amount_paid: 100, status: "paid", issue_date: "2026-01-10", due_date: "2026-02-10" },
    { total: 200, amount_paid: 50, status: "partial", issue_date: "2026-03-05", due_date: "2026-04-05" },
    { total: "300", amount_paid: "0", status: "sent", issue_date: "2026-06-01", due_date: "2026-07-01" },
    { total: 999, amount_paid: 0, status: "void", issue_date: "2026-06-02", due_date: "2026-01-01" },
  ];

  test("sums revenue, receivables and overdue, ignoring void invoices", () => {
    const k = computeDashboardKpis(invoices, [{ total: 40 }, { total: "60" }], [{ amount: 25 }], today);
    expect(k.revenue).toBe(150);
    expect(k.receivables).toBe(450); // 150 + 300
    expect(k.overdueCount).toBe(1); // only the partial one is past due
    expect(k.payables).toBe(100);
    expect(k.expenses).toBe(25);
  });

  test("buckets invoiced totals by month", () => {
    const k = computeDashboardKpis(invoices, [], [], today);
    expect(k.monthly).toHaveLength(12);
    expect(k.monthly[0]).toBe(100);
    expect(k.monthly[2]).toBe(200);
    expect(k.monthly[5]).toBe(300); // void excluded
  });

  test("handles empty input", () => {
    const k = computeDashboardKpis([], [], [], today);
    expect(k).toEqual({ revenue: 0, receivables: 0, payables: 0, expenses: 0, overdueCount: 0, monthly: Array(12).fill(0) });
  });
});

describe("joinById", () => {
  const customers = [
    { id: "c1", billing_name: "Northwind" },
    { id: "c2", billing_name: "Braavos" },
  ];

  test("attaches the picked lookup value, or null when missing", () => {
    const rows = [
      { id: "q1", customer_id: "c2" as string | null },
      { id: "q2", customer_id: null },
      { id: "q3", customer_id: "deleted" },
    ];
    const out = joinById(rows, "customer_id", customers, "customer", (c) => ({ billing_name: c.billing_name }));
    expect(out[0].customer).toEqual({ billing_name: "Braavos" });
    expect(out[1].customer).toBeNull();
    expect(out[2].customer).toBeNull();
    expect(out[0].id).toBe("q1");
  });
});

describe("statusTone", () => {
  test("returns the mapped tone and falls back to draft", () => {
    expect(statusTone("paid")).toBe(STATUS_TONE.paid);
    expect(statusTone("something-new")).toBe(STATUS_TONE.draft);
    expect(statusTone(null)).toBe(STATUS_TONE.draft);
  });
});
