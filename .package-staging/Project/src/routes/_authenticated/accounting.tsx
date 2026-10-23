import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/org-context";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, BookOpen, FileCheck2 } from "lucide-react";
import { toast } from "sonner";
import { money, fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/accounting")({
  component: AccountingPage,
});

type AccountType = "asset" | "liability" | "equity" | "income" | "expense";
interface Account {
  id: string; code: string; name: string; type: AccountType; is_active: boolean;
}
interface JournalEntry {
  id: string; entry_date: string; memo: string | null; reference: string | null; is_posted: boolean;
}
interface JournalLine {
  id: string; entry_id: string; account_id: string; debit: number; credit: number; description: string | null; position: number;
}

const TYPE_COLORS: Record<AccountType, string> = {
  asset: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  liability: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
  equity: "bg-purple-500/10 text-purple-700 dark:text-purple-300",
  income: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  expense: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
};

function AccountingPage() {
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [lines, setLines] = useState<JournalLine[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!currentOrg) return;
    setLoading(true);
    const [{ data: a }, { data: e }, { data: l }] = await Promise.all([
      supabase.from("accounts").select("*").eq("organization_id", currentOrg.id).order("code"),
      supabase.from("journal_entries").select("*").eq("organization_id", currentOrg.id).order("entry_date", { ascending: false }),
      supabase.from("journal_lines").select("*").eq("organization_id", currentOrg.id),
    ]);
    setAccounts((a ?? []) as Account[]);
    setEntries((e ?? []) as JournalEntry[]);
    setLines((l ?? []) as JournalLine[]);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [currentOrg?.id]);

  

  // Trial balance + P&L from POSTED lines only
  const postedEntryIds = useMemo(() => new Set(entries.filter(e => e.is_posted).map(e => e.id)), [entries]);
  const balances = useMemo(() => {
    const map = new Map<string, { debit: number; credit: number }>();
    for (const ln of lines) {
      if (!postedEntryIds.has(ln.entry_id)) continue;
      const b = map.get(ln.account_id) ?? { debit: 0, credit: 0 };
      b.debit += Number(ln.debit) || 0;
      b.credit += Number(ln.credit) || 0;
      map.set(ln.account_id, b);
    }
    return map;
  }, [lines, postedEntryIds]);

  const pnl = useMemo(() => {
    let income = 0, expense = 0;
    for (const acc of accounts) {
      const b = balances.get(acc.id);
      if (!b) continue;
      if (acc.type === "income") income += b.credit - b.debit;
      if (acc.type === "expense") expense += b.debit - b.credit;
    }
    return { income, expense, net: income - expense };
  }, [accounts, balances]);

  if (!currentOrg) return <div className="p-8 text-muted-foreground">Select a workspace first.</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Accounting</h1>
          <p className="text-sm text-muted-foreground">Chart of accounts, journal entries, trial balance, and P&amp;L.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Accounts</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{accounts.length}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Posted Entries</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{postedEntryIds.size}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Revenue</CardTitle></CardHeader><CardContent className="text-2xl font-semibold text-emerald-600">{money(pnl.income, currentOrg.currency)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Net Income</CardTitle></CardHeader><CardContent className={`text-2xl font-semibold ${pnl.net >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{money(pnl.net, currentOrg.currency)}</CardContent></Card>
      </div>

      <Tabs defaultValue="journal">
        <TabsList>
          <TabsTrigger value="journal">Journal</TabsTrigger>
          <TabsTrigger value="accounts">Chart of Accounts</TabsTrigger>
          <TabsTrigger value="trial">Trial Balance</TabsTrigger>
          <TabsTrigger value="pnl">P&amp;L</TabsTrigger>
        </TabsList>

        <TabsContent value="journal" className="space-y-4">
          <div className="flex justify-end">
            <NewEntryDialog accounts={accounts} orgId={currentOrg.id} userId={user!.id} onCreated={load} />
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Memo</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow> :
                   entries.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No journal entries yet.</TableCell></TableRow> :
                   entries.map(e => {
                    const els = lines.filter(l => l.entry_id === e.id);
                    const d = els.reduce((s, l) => s + Number(l.debit), 0);
                    const c = els.reduce((s, l) => s + Number(l.credit), 0);
                    return (
                      <TableRow key={e.id}>
                        <TableCell>{fmtDate(e.entry_date)}</TableCell>
                        <TableCell className="max-w-xs truncate">{e.memo || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{e.reference || "—"}</TableCell>
                        <TableCell className="text-right font-mono">{money(d, currentOrg.currency)}</TableCell>
                        <TableCell className="text-right font-mono">{money(c, currentOrg.currency)}</TableCell>
                        <TableCell>
                          {e.is_posted ? <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">Posted</Badge>
                                       : <Badge variant="outline">Draft</Badge>}
                        </TableCell>
                        <TableCell className="text-right">
                          {!e.is_posted && (
                            <Button size="sm" variant="outline" onClick={async () => {
                              const { error } = await supabase.from("journal_entries").update({ is_posted: true }).eq("id", e.id);
                              if (error) toast.error(error.message); else { toast.success("Posted"); load(); }
                            }}>
                              <FileCheck2 className="h-3.5 w-3.5 mr-1" />Post
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accounts" className="space-y-4">
          <div className="flex justify-end">
            <NewAccountDialog orgId={currentOrg.id} onCreated={load} />
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map(a => {
                    const b = balances.get(a.id) ?? { debit: 0, credit: 0 };
                    const isDebitNature = a.type === "asset" || a.type === "expense";
                    const bal = isDebitNature ? b.debit - b.credit : b.credit - b.debit;
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="font-mono">{a.code}</TableCell>
                        <TableCell className="font-medium">{a.name}</TableCell>
                        <TableCell><Badge className={TYPE_COLORS[a.type]} variant="secondary">{a.type}</Badge></TableCell>
                        <TableCell className="text-right font-mono">{money(bal, currentOrg.currency)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trial">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><BookOpen className="h-4 w-4" />Trial Balance (Posted)</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Account</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead></TableRow></TableHeader>
                <TableBody>
                  {accounts.filter(a => balances.has(a.id)).map(a => {
                    const b = balances.get(a.id)!;
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="font-mono">{a.code}</TableCell>
                        <TableCell>{a.name}</TableCell>
                        <TableCell className="text-right font-mono">{b.debit > 0 ? money(b.debit, currentOrg.currency) : "—"}</TableCell>
                        <TableCell className="text-right font-mono">{b.credit > 0 ? money(b.credit, currentOrg.currency) : "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="font-semibold border-t-2">
                    <TableCell colSpan={2}>Total</TableCell>
                    <TableCell className="text-right font-mono">{money([...balances.values()].reduce((s, b) => s + b.debit, 0), currentOrg.currency)}</TableCell>
                    <TableCell className="text-right font-mono">{money([...balances.values()].reduce((s, b) => s + b.credit, 0), currentOrg.currency)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pnl">
          <Card>
            <CardHeader><CardTitle className="text-base">Profit &amp; Loss</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <PnLSection title="Income" type="income" accounts={accounts} balances={balances} currency={currentOrg.currency} total={pnl.income} />
              <PnLSection title="Expenses" type="expense" accounts={accounts} balances={balances} currency={currentOrg.currency} total={pnl.expense} />
              <div className="flex justify-between border-t-2 pt-4 text-lg font-semibold">
                <span>Net Income</span>
                <span className={pnl.net >= 0 ? "text-emerald-600" : "text-rose-600"}>{money(pnl.net, currentOrg.currency)}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PnLSection({ title, type, accounts, balances, currency, total }: {
  title: string; type: AccountType; accounts: Account[]; balances: Map<string, { debit: number; credit: number }>; currency: string; total: number;
}) {
  const rows = accounts.filter(a => a.type === type && balances.has(a.id));
  return (
    <div>
      <h3 className="font-semibold mb-2">{title}</h3>
      <div className="space-y-1">
        {rows.length === 0 ? <div className="text-sm text-muted-foreground">No activity.</div> :
         rows.map(a => {
          const b = balances.get(a.id)!;
          const v = type === "income" ? b.credit - b.debit : b.debit - b.credit;
          return (
            <div key={a.id} className="flex justify-between text-sm">
              <span className="text-muted-foreground"><span className="font-mono mr-2">{a.code}</span>{a.name}</span>
              <span className="font-mono">{money(v, currency)}</span>
            </div>
          );
        })}
        <div className="flex justify-between border-t pt-2 mt-2 font-medium">
          <span>Total {title}</span><span className="font-mono">{money(total, currency)}</span>
        </div>
      </div>
    </div>
  );
}

function NewAccountDialog({ orgId, onCreated }: { orgId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState(""); const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("expense");
  const submit = async () => {
    if (!code || !name) return toast.error("Code and name are required");
    const { error } = await supabase.from("accounts").insert({ organization_id: orgId, code, name, type });
    if (error) toast.error(error.message);
    else { toast.success("Account created"); setOpen(false); setCode(""); setName(""); onCreated(); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />New Account</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New Account</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Code</Label><Input value={code} onChange={e => setCode(e.target.value)} placeholder="e.g. 6600" /></div>
          <div><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Bank Fees" /></div>
          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as AccountType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="asset">Asset</SelectItem>
                <SelectItem value="liability">Liability</SelectItem>
                <SelectItem value="equity">Equity</SelectItem>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter><Button onClick={submit}>Create</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface DraftLine { account_id: string; debit: string; credit: string; description: string; }

function NewEntryDialog({ accounts, orgId, userId, onCreated }: { accounts: Account[]; orgId: string; userId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [memo, setMemo] = useState(""); const [reference, setReference] = useState("");
  const [rows, setRows] = useState<DraftLine[]>([
    { account_id: "", debit: "", credit: "", description: "" },
    { account_id: "", debit: "", credit: "", description: "" },
  ]);
  const totals = rows.reduce((acc, r) => ({ d: acc.d + (Number(r.debit) || 0), c: acc.c + (Number(r.credit) || 0) }), { d: 0, c: 0 });
  const balanced = totals.d === totals.c && totals.d > 0;

  const submit = async (post: boolean) => {
    if (!balanced) return toast.error("Entry must be balanced and non-zero");
    if (rows.some(r => !r.account_id)) return toast.error("Pick an account on every line");

    const { data: entry, error } = await supabase.from("journal_entries").insert({
      organization_id: orgId, entry_date: date, memo: memo || null, reference: reference || null, created_by: userId,
    }).select().single();
    if (error || !entry) return toast.error(error?.message || "Failed");

    const linesPayload = rows.map((r, i) => ({
      organization_id: orgId, entry_id: entry.id, account_id: r.account_id, position: i,
      debit: Number(r.debit) || 0, credit: Number(r.credit) || 0, description: r.description || null,
    }));
    const { error: lerr } = await supabase.from("journal_lines").insert(linesPayload);
    if (lerr) return toast.error(lerr.message);

    if (post) {
      const { error: perr } = await supabase.from("journal_entries").update({ is_posted: true }).eq("id", entry.id);
      if (perr) return toast.error(perr.message);
    }
    toast.success(post ? "Posted" : "Draft saved");
    setOpen(false); setMemo(""); setReference("");
    setRows([{ account_id: "", debit: "", credit: "", description: "" }, { account_id: "", debit: "", credit: "", description: "" }]);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />New Entry</Button></DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>New Journal Entry</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Date</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
            <div><Label>Reference</Label><Input value={reference} onChange={e => setReference(e.target.value)} placeholder="optional" /></div>
            <div><Label>Memo</Label><Input value={memo} onChange={e => setMemo(e.target.value)} placeholder="optional" /></div>
          </div>

          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Account</TableHead><TableHead>Description</TableHead>
                <TableHead className="w-32 text-right">Debit</TableHead><TableHead className="w-32 text-right">Credit</TableHead><TableHead className="w-8"></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Select value={r.account_id} onValueChange={(v) => { const c = [...rows]; c[i].account_id = v; setRows(c); }}>
                        <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                        <SelectContent>
                          {accounts.map(a => <SelectItem key={a.id} value={a.id}><span className="font-mono mr-2">{a.code}</span>{a.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell><Input value={r.description} onChange={e => { const c = [...rows]; c[i].description = e.target.value; setRows(c); }} /></TableCell>
                    <TableCell><Input type="number" step="0.01" className="text-right font-mono" value={r.debit}
                      onChange={e => { const c = [...rows]; c[i].debit = e.target.value; if (e.target.value) c[i].credit = ""; setRows(c); }} /></TableCell>
                    <TableCell><Input type="number" step="0.01" className="text-right font-mono" value={r.credit}
                      onChange={e => { const c = [...rows]; c[i].credit = e.target.value; if (e.target.value) c[i].debit = ""; setRows(c); }} /></TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => setRows(rows.filter((_, j) => j !== i))} disabled={rows.length <= 2}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex justify-between items-center">
            <Button variant="outline" size="sm" onClick={() => setRows([...rows, { account_id: "", debit: "", credit: "", description: "" }])}>
              <Plus className="h-3.5 w-3.5 mr-1" />Add line
            </Button>
            <div className="flex gap-6 text-sm font-mono">
              <span>Debit: {totals.d.toFixed(2)}</span>
              <span>Credit: {totals.c.toFixed(2)}</span>
              <span className={balanced ? "text-emerald-600 font-semibold" : "text-rose-600 font-semibold"}>
                {balanced ? "Balanced" : `Diff: ${(totals.d - totals.c).toFixed(2)}`}
              </span>
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => submit(false)}>Save as Draft</Button>
          <Button onClick={() => submit(true)} disabled={!balanced}>Save &amp; Post</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
