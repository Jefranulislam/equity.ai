/**
 * Single source of truth for document status badge colours, shared by
 * invoices, bills, quotes, purchase orders, credit notes and the dashboard.
 */
export const STATUS_TONE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  open: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  issued: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  accepted: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  partial: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  paid: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  received: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  converted: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  applied: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  expired: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
  declined: "bg-destructive/10 text-destructive",
  rejected: "bg-destructive/10 text-destructive",
  cancelled: "bg-destructive/10 text-destructive",
  void: "bg-destructive/10 text-destructive",
};

/** Badge classes for a status; unknown statuses fall back to the neutral tone. */
export const statusTone = (status: string | null | undefined): string =>
  STATUS_TONE[status ?? ""] ?? STATUS_TONE.draft;
