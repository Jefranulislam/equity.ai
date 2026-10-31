import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/org-context";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { fmtDate } from "@/lib/format";
import { useServerFn } from "@tanstack/react-start";
import { inviteMember } from "@/lib/members.functions";

export const Route = createFileRoute("/_authenticated/members")({
  head: () => ({ meta: [{ title: "Team — Equity.AI" }] }),
  component: Page,
});

type Role = "owner" | "admin" | "accountant" | "sales" | "inventory" | "viewer";
interface Member { id: string; user_id: string; role: Role; created_at: string; profile: { full_name: string | null } | null; }

function Page() {
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("viewer");
  const [saving, setSaving] = useState(false);
  const inviteFn = useServerFn(inviteMember);

  const load = async () => {
    if (!currentOrg) return;
    const { data } = await supabase.from("organization_members")
      .select("id,user_id,role,created_at,profile:profiles(full_name)")
      .eq("organization_id", currentOrg.id);
    setMembers((data ?? []) as unknown as Member[]);
  };
  useEffect(() => { load(); }, [currentOrg?.id]);

  const myRole = members.find(m => m.user_id === user?.id)?.role;
  const canManage = myRole === "owner" || myRole === "admin";

  const invite = async () => {
    if (!currentOrg || !email.trim()) return;
    setSaving(true);
    const payload = { email: email.trim(), role: role as Exclude<Role, "owner">, organization_id: currentOrg.id };
    let invited = false;
    try {
      // SSR path: TanStack server function (service-role client).
      await inviteFn({ data: payload });
      invited = true;
    } catch {
      // Static-deployment fallback: SECURITY DEFINER RPC
      // (supabase/migrations/20260617000002_invite_member_rpc.sql).
      const { error } = await supabase.rpc("invite_member", {
        p_email: payload.email,
        p_role: payload.role,
        p_org: payload.organization_id,
      });
      if (!error) invited = true;
    }
    if (invited) {
      toast.success("Member added");
      setEmail(""); setOpen(false); load();
    } else {
      toast.error("Failed to invite member — check the email is registered and your role.");
    }
    setSaving(false);
  };

  const updateRole = async (id: string, r: Role) => {
    const { error } = await supabase.from("organization_members").update({ role: r }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Role updated"); load();
  };
  const remove = async (id: string) => {
    if (!confirm("Remove this member?")) return;
    const { error } = await supabase.from("organization_members").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removed"); load();
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Team & Roles</h1>
          <p className="text-muted-foreground text-sm">Manage who has access to {currentOrg?.name}</p>
        </div>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><UserPlus className="size-4 mr-1" />Invite member</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Invite a teammate</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="teammate@company.com" /></div>
                <div><Label>Role</Label>
                  <Select value={role} onValueChange={v => setRole(v as Role)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="accountant">Accountant</SelectItem>
                      <SelectItem value="sales">Sales</SelectItem>
                      <SelectItem value="inventory">Inventory</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">The user must already have a Equity.AI account. They will gain access immediately.</p>
              </div>
              <DialogFooter><Button onClick={invite} disabled={saving}>{saving ? "Adding…" : "Add member"}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Role</TableHead><TableHead>Joined</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {members.map(m => (
              <TableRow key={m.id}>
                <TableCell>{m.profile?.full_name ?? m.user_id.slice(0, 8)}{m.user_id === user?.id && <span className="text-muted-foreground text-xs ml-2">(you)</span>}</TableCell>
                <TableCell>
                  {canManage && m.role !== "owner" ? (
                    <Select value={m.role} onValueChange={v => updateRole(m.id, v as Role)}>
                      <SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="accountant">Accountant</SelectItem>
                        <SelectItem value="sales">Sales</SelectItem>
                        <SelectItem value="inventory">Inventory</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : <span className="capitalize">{m.role}</span>}
                </TableCell>
                <TableCell>{fmtDate(m.created_at)}</TableCell>
                <TableCell className="text-right">
                  {canManage && m.role !== "owner" && m.user_id !== user?.id && (
                    <Button variant="ghost" size="sm" onClick={() => remove(m.id)}><Trash2 className="size-4 text-destructive" /></Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
