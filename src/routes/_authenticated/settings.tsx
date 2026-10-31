import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Building2,
  User as UserIcon,
  Users,
  Save,
  Trash2,
  Loader2,
  Sparkles,
  Key,
  EyeOff,
  Eye,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useOrg } from "@/contexts/org-context";
import { supabase } from "@/integrations/supabase/client";
import { fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Equity.AI" }] }),
  component: Settings,
});

type Tab = "workspace" | "profile" | "team" | "ai";

const ROLES = ["owner", "admin", "accountant", "sales", "inventory", "viewer"] as const;
type Role = (typeof ROLES)[number];

interface Member {
  id: string;
  user_id: string;
  role: Role;
  created_at: string;
  profile: { full_name: string | null; avatar_url: string | null } | null;
}

function Settings() {
  const [tab, setTab] = useState<Tab>("workspace");

  return (
    <div className="p-8 max-w-5xl mx-auto w-full">
      <div className="mb-8 animate-reveal">
        <h1 className="text-2xl font-bold tracking-tight mb-1">Settings</h1>
        <p className="text-muted-foreground">Workspace, profile, and team access</p>
      </div>

      <div className="flex gap-1 border-b border-border mb-8">
        {(
          [
            { id: "workspace", label: "Workspace", icon: Building2 },
            { id: "profile", label: "Profile", icon: UserIcon },
            { id: "team", label: "Team", icon: Users },
            { id: "ai", label: "AI", icon: Sparkles },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 flex items-center gap-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? "border-accent text-accent"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="size-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "workspace" && <WorkspacePanel />}
      {tab === "profile" && <ProfilePanel />}
      {tab === "team" && <TeamPanel />}
      {tab === "ai" && <AiPanel />}
    </div>
  );
}

/* ───── Workspace ───── */
function WorkspacePanel() {
  const { currentOrg, refresh } = useOrg();
  const [form, setForm] = useState({ name: "", country: "", currency: "", tax_regime: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (currentOrg) {
      supabase
        .from("organizations")
        .select("name,country,currency,tax_regime")
        .eq("id", currentOrg.id)
        .single()
        .then(({ data }) => {
          if (data)
            setForm({
              name: data.name ?? "",
              country: data.country ?? "",
              currency: data.currency ?? "",
              tax_regime: data.tax_regime ?? "",
            });
        });
    }
  }, [currentOrg]);

  const save = async () => {
    if (!currentOrg) return;
    setSaving(true);
    setMsg(null);
    const { error } = await supabase.from("organizations").update(form).eq("id", currentOrg.id);
    setSaving(false);
    if (error) setMsg(error.message);
    else {
      setMsg("Saved");
      refresh();
      setTimeout(() => setMsg(null), 2000);
    }
  };

  if (!currentOrg) return <Empty>No workspace selected.</Empty>;

  return (
    <Card title="Workspace details" subtitle="Visible across invoices, reports and emails">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field label="Name">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={inputCls}
          />
        </Field>
        <Field label="Country (ISO)">
          <input
            value={form.country}
            onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase() })}
            maxLength={2}
            className={inputCls}
          />
        </Field>
        <Field label="Currency (ISO)">
          <input
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
            maxLength={3}
            className={inputCls}
          />
        </Field>
        <Field label="Tax regime">
          <input
            value={form.tax_regime}
            onChange={(e) => setForm({ ...form, tax_regime: e.target.value })}
            placeholder="VAT, GST, Sales Tax…"
            className={inputCls}
          />
        </Field>
      </div>
      <div className="flex items-center gap-3 mt-6">
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 bg-accent text-accent-foreground rounded-md font-medium text-sm flex items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
          Save changes
        </button>
        {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
      </div>
    </Card>
  );
}

/* ───── Profile ───── */
function ProfilePanel() {
  const { user } = useAuth();
  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single()
      .then(({ data }) => setFullName(data?.full_name ?? ""));
  }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    setMsg(null);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName })
      .eq("id", user.id);
    setSaving(false);
    if (error) setMsg(error.message);
    else {
      setMsg("Saved");
      setTimeout(() => setMsg(null), 2000);
    }
  };

  return (
    <Card title="Your profile" subtitle="Shown to teammates across the workspace">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field label="Full name">
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Email">
          <input value={user?.email ?? ""} disabled className={inputCls + " opacity-60"} />
        </Field>
      </div>
      <div className="flex items-center gap-3 mt-6">
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 bg-accent text-accent-foreground rounded-md font-medium text-sm flex items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
          Save
        </button>
        {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
      </div>
    </Card>
  );
}

/* ───── Team ───── */
function TeamPanel() {
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [myRole, setMyRole] = useState<Role | null>(null);

  const load = async () => {
    if (!currentOrg) return;
    setLoading(true);
    const { data } = await supabase
      .from("organization_members")
      .select("id,user_id,role,created_at,profile:profiles(full_name,avatar_url)")
      .eq("organization_id", currentOrg.id)
      .order("created_at", { ascending: true });
    const list = (data ?? []) as unknown as Member[];
    setMembers(list);
    setMyRole(list.find((m) => m.user_id === user?.id)?.role ?? null);
    setLoading(false);
  };

  useEffect(() => {
    load(); /* eslint-disable-next-line */
  }, [currentOrg?.id, user?.id]);

  const canManage = myRole === "owner" || myRole === "admin";

  const changeRole = async (id: string, role: Role) => {
    await supabase.from("organization_members").update({ role }).eq("id", id);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this member from the workspace?")) return;
    await supabase.from("organization_members").delete().eq("id", id);
    load();
  };

  if (!currentOrg) return <Empty>No workspace selected.</Empty>;

  return (
    <Card
      title="Team members"
      subtitle={canManage ? "Manage roles and access" : "Read-only — contact an owner or admin"}
    >
      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b border-border">
            <tr>
              <th className="px-4 py-2.5 text-left font-semibold text-[11px] uppercase tracking-wider text-muted-foreground">
                Member
              </th>
              <th className="px-4 py-2.5 text-left font-semibold text-[11px] uppercase tracking-wider text-muted-foreground">
                Role
              </th>
              <th className="px-4 py-2.5 text-left font-semibold text-[11px] uppercase tracking-wider text-muted-foreground">
                Joined
              </th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            )}
            {members.map((m) => {
              const isSelf = m.user_id === user?.id;
              const isOwner = m.role === "owner";
              const editable = canManage && !isOwner && !isSelf;
              return (
                <tr key={m.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-full bg-accent/10 text-accent flex items-center justify-center text-[11px] font-bold uppercase">
                        {(m.profile?.full_name ?? "?").slice(0, 2)}
                      </div>
                      <div>
                        <div className="font-medium">
                          {m.profile?.full_name ?? "Unknown"}{" "}
                          {isSelf && (
                            <span className="text-[10px] text-muted-foreground">(you)</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {editable ? (
                      <select
                        value={m.role}
                        onChange={(e) => changeRole(m.id, e.target.value as Role)}
                        className="bg-background border border-border rounded px-2 py-1 text-xs font-mono uppercase"
                      >
                        {ROLES.filter((r) => r !== "owner").map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-muted">
                        {m.role}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {fmtDate(m.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {editable && (
                      <button
                        onClick={() => remove(m.id)}
                        className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        title="Remove"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground mt-4">
        Invitations are coming soon. For now, share the signup link — new accounts get their own
        workspace and can be added here on request.
      </p>
    </Card>
  );
}

/* ───── AI (bring-your-own-key) ───── */
function AiPanel() {
  const { user, session } = useAuth();
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const savedKey = typeof meta.openrouter_api_key === "string" ? meta.openrouter_api_key : "";
  const savedModel = typeof meta.openrouter_model === "string" ? meta.openrouter_model : "";

  useEffect(() => {
    if (user) setModel(savedModel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id ?? ""]);

  const save = async () => {
    if (!session) return;
    const key = apiKey.trim();
    if (key && !key.startsWith("sk-or-")) {
      setErr('OpenRouter keys start with "sk-or-" — that doesn\'t look like one.');
      return;
    }
    setSaving(true);
    setMsg(null);
    setErr(null);
    const data: Record<string, string | null> = { openrouter_model: model.trim() || null };
    if (key) data.openrouter_api_key = key;
    const { error } = await supabase.auth.updateUser({ data });
    setSaving(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setApiKey("");
    setMsg(
      key
        ? "Saved — Freya now uses your OpenRouter key."
        : savedKey
          ? "Saved — OpenRouter key already active."
          : "Saved.",
    );
    setTimeout(() => setMsg(null), 2500);
  };

  const removeKey = async () => {
    if (!session) return;
    setRemoving(true);
    setErr(null);
    const { error } = await supabase.auth.updateUser({ data: { openrouter_api_key: null } });
    setRemoving(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setMsg("Key removed — Freya falls back to the platform default.");
    setTimeout(() => setMsg(null), 2500);
  };

  const maskedKey = savedKey
    ? savedKey.slice(0, 9) + "•".repeat(Math.max(6, savedKey.length - 13)) + savedKey.slice(-4)
    : "";

  return (
    <Card
      title="Freya's AI model"
      subtitle="Bring your own OpenRouter key — Freya runs on the model you choose"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field label="OpenRouter API key">
          <div className="relative">
            <Key className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type={show ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={savedKey ? maskedKey : "sk-or-v1-…"}
              autoComplete="off"
              spellCheck={false}
              className={inputCls + " pl-9 pr-10 font-mono text-[13px]"}
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              title={show ? "Hide" : "Show"}
            >
              {show ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            </button>
          </div>
        </Field>
        <Field label="Model (optional)">
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="google/gemini-2.5-flash"
            spellCheck={false}
            className={inputCls + " font-mono text-[13px]"}
          />
        </Field>
      </div>

      <div className="flex items-start gap-2 mt-3 p-3 rounded-md bg-muted/30 border border-border">
        <Sparkles className="size-3.5 mt-0.5 text-accent shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          {savedKey ? (
            <>
              Connected with your key <span className="font-mono text-[11px]">{maskedKey}</span>
              {savedModel && (
                <>
                  {" "}
                  using model <span className="font-mono text-[11px]">{savedModel}</span>
                </>
              )}
              .{" "}
              <button
                onClick={removeKey}
                className="underline hover:text-destructive transition-colors disabled:opacity-50"
                disabled={removing}
              >
                {removing ? "Removing…" : "Remove key"}
              </button>
            </>
          ) : (
            <>
              No personal key yet — Freya uses the platform's default model while in beta.{" "}
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-foreground transition-colors"
              >
                Get a free OpenRouter key ↗
              </a>{" "}
            </>
          )}
        </p>
      </div>

      <p className="text-[11px] text-muted-foreground mt-3">
        Your key is stored in your account's secure user metadata and is only readable by our server
        when serving your own AI Agent requests — it's never shared, logged, or used for other
        users.
      </p>

      <div className="flex items-center gap-3 mt-6">
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 bg-accent text-accent-foreground rounded-md font-medium text-sm flex items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
          Save
        </button>
        {(msg || err) && (
          <span className={`text-xs ${err ? "text-destructive" : "text-muted-foreground"}`}>
            {err ?? msg}
          </span>
        )}
      </div>
    </Card>
  );
}

/* ───── helpers ───── */
const inputCls =
  "w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent";

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border rounded-xl bg-card p-6 animate-reveal">
      <div className="mb-5">
        <h2 className="font-bold text-base tracking-tight">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
        {label}
      </span>
      {children}
    </label>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-12 text-center text-muted-foreground border border-dashed border-border rounded-xl">
      {children}
    </div>
  );
}
