import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import * as Accordion from "@radix-ui/react-accordion";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BrainCircuit,
  Calculator,
  CheckCheck,
  FileText,
  Landmark,
  Lock,
  ScrollText,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { launchDemo } from "@/lib/demo";
import heroShot from "@/assets/landing/app-dashboard.png";
import accountingShot from "@/assets/landing/app-accounting.png";
import complianceShot from "@/assets/landing/app-compliance.png";
import settingsShot from "@/assets/landing/app-settings.png";
import freyaShot from "@/assets/landing/app-freya.png";

/* ══════════════════════════════════════════════════════════ design tokens ═══ */

const INK = "#0B1220";
const GREEN = "#16A34A";
const AMBER = "#F59E0B";

/* ═══════════════════════════════════════════════════════════════ utilities ═══ */

function useReveal() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(".rv"));
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("rv-in");
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.12 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

function useParallax() {
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
        document.querySelectorAll<HTMLElement>("[data-parallax]").forEach((el) => {
          const speed = Number(el.dataset.parallax ?? 0);
          el.style.transform = `translateY(${y * speed}px)`;
        });
        raf = 0;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
}

const MODULES = [
  "Dashboard",
  "Quotes",
  "Invoices",
  "Payments",
  "Credit Notes",
  "Customers",
  "Inventory",
  "Purchase Orders",
  "Bills",
  "Vendor Payments",
  "Vendors",
  "Expenses",
  "Accounting",
  "Reports",
  "Sales",
  "Compliance",
  "Team",
  "AI Agent",
];

/* ════════════════════════════════════════════════════════════════ components ═══ */

function DemoButton({
  variant = "dark",
  label = "Launch the live demo",
}: {
  variant?: "dark" | "blue" | "outline";
  label?: string;
}) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await launchDemo();
      navigate({ to: "/dashboard" });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  const base =
    "group inline-flex items-center justify-center gap-2 rounded-xl px-6 h-12 font-semibold text-[15px] transition-all duration-300 disabled:opacity-60";
  const styles =
    variant === "dark"
      ? "bg-[#0B1220] text-white hover:bg-[#2E5CF6] shadow-[0_12px_30px_-12px_rgba(11,18,32,0.45)] hover:shadow-[0_16px_36px_-12px_rgba(46,92,246,0.55)]"
      : variant === "blue"
        ? "bg-[#2E5CF6] text-white hover:bg-[#0B1220] shadow-[0_12px_30px_-12px_rgba(46,92,246,0.5)]"
        : "border border-[#0B1220]/15 text-[#0B1220] bg-white/70 hover:border-[#0B1220]/40 hover:bg-white";

  return (
    <span className="inline-flex flex-col">
      <button
        onClick={go}
        disabled={busy}
        className={`${base} ${styles}`}
        aria-label="Open the one-click demo workspace"
      >
        {busy ? "Preparing your workspace…" : label}
        {busy ? (
          <span
            className="size-4 border-2 border-white/40 border-t-white rounded-full animate-spin"
            aria-hidden
          />
        ) : (
          <ArrowRight
            className="size-4 transition-transform duration-300 group-hover:translate-x-1"
            aria-hidden
          />
        )}
      </button>
      {error && (
        <span role="alert" className="mt-2 text-xs text-red-600">
          {error} — you can also create a free account.
        </span>
      )}
    </span>
  );
}

function MicroLabel({ children }: { children: ReactNode }) {
  return (
    <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#7A8699]">
      {children}
    </div>
  );
}

function Section({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <section className={`mx-auto w-full max-w-[1200px] px-5 md:px-8 ${className}`}>
      {children}
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────── nav ——— */

function Nav() {
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${solid ? "bg-white/85 backdrop-blur-md border-b border-[#E5E9F0]" : "bg-transparent"}`}
    >
      <Section>
        <nav className="flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5" aria-label="Equity.AI home">
            <LogoMark />
            <span className="font-extrabold tracking-tight text-[17px]" style={{ color: INK }}>
              EQUITY<span className="text-[#2E5CF6]">.AI</span>
            </span>
          </Link>
          <div className="hidden lg:flex items-center gap-8 text-sm font-medium text-[#3D485E]">
            <a href="#modules" className="hover:text-[#0B1220] transition-colors">
              Modules
            </a>
            <a href="#freya" className="hover:text-[#0B1220] transition-colors">
              Freya AI
            </a>
            <a href="#demo" className="hover:text-[#0B1220] transition-colors">
              Live demo
            </a>
            <a href="#faq" className="hover:text-[#0B1220] transition-colors">
              FAQ
            </a>
          </div>
          <div className="flex items-center gap-3">
            {/* Free login — always visible on the menu bar */}
            <Link
              to="/login"
              className="inline-flex h-10 items-center rounded-lg px-4 text-sm font-semibold text-[#0B1220] hover:bg-[#F0F3F9] transition-colors"
            >
              Log in
            </Link>
            <DemoButton variant="dark" label="Launch demo" />
          </div>
        </nav>
      </Section>
    </header>
  );
}

function LogoMark() {
  return (
    <span
      className="inline-flex size-8 items-center justify-center rounded-[10px] bg-[#0B1220]"
      aria-hidden
    >
      <span className="size-3.5 rounded-full bg-white" />
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────── hero ——— */

function Hero() {
  return (
    <div className="relative overflow-hidden pt-32 pb-20 md:pt-40 md:pb-28">
      {/* atmospheric ground: cool wash + faint grid */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,#EAF1FC_0%,#F7FAFF_46%,#FFFFFF_100%)]"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-[0.5]"
        style={{
          backgroundImage:
            "linear-gradient(#E2E9F5 1px,transparent 1px),linear-gradient(90deg,#E2E9F5 1px,transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse 90% 70% at 50% 0%, black 30%, transparent 78%)",
        }}
      />

      <Section className="grid items-center gap-14 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <div className="rv inline-flex items-center gap-2 rounded-full border border-[#C9D6EE] bg-white/80 px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-[#2E5CF6]">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#2E5CF6] opacity-60" />
              <span className="relative inline-flex size-1.5 rounded-full bg-[#2E5CF6]" />
            </span>
            Free while in beta · no card required
          </div>
          <h1
            className="rv delay-1 mt-6 text-balance text-[clamp(2.6rem,5.4vw,4.1rem)] font-extrabold leading-[1.02] tracking-[-0.045em]"
            style={{ color: INK }}
          >
            AI&#8209;powered ERP & <span className="text-[#2E5CF6]">Accounting</span> for SMBs
          </h1>
          <p className="rv delay-2 mt-6 max-w-[56ch] text-[17px] leading-[1.65] text-[#5B6578]">
            Manage invoices, payments, inventory, bills and double-entry accounting in one unified
            workspace — with <strong className="font-semibold text-[#0B1220]">Freya</strong>, an AI
            accountant grounded in your live ledger, watching every entry in real time.
          </p>
          <div className="rv delay-3 mt-8 flex flex-wrap items-center gap-3.5">
            <DemoButton variant="dark" label="Explore the live demo — no signup" />
            <Link
              to="/login"
              className="group inline-flex h-12 items-center gap-2 rounded-xl border border-[#0B1220]/15 px-6 text-[15px] font-semibold text-[#0B1220] transition-all hover:border-[#0B1220]/40 hover:bg-white"
            >
              Create free account
              <ArrowUpRight
                className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                aria-hidden
              />
            </Link>
          </div>
          <div className="rv delay-4 mt-9 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[11px] uppercase tracking-[0.14em] text-[#7A8699]">
            <span className="inline-flex items-center gap-1.5">
              <Lock className="size-3" aria-hidden /> RLS-isolated workspaces
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Calculator className="size-3" aria-hidden /> Double-entry by default
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ScrollText className="size-3" aria-hidden /> Filing-ready tax exports
            </span>
          </div>
        </div>

        {/* Product slate: framed dashboard + floating telemetry chips */}
        <div className="rv delay-2  w-250 relative" style={{ perspective: "1600px" }}>
          <div className="relative rounded-2xl border border-[#D8E1F0] bg-white p-2 shadow-[0_50px_100px_-30px_rgba(15,30,70,0.28),0_4px_14px_-6px_rgba(15,30,70,0.12)]">
            <div className="flex items-center gap-1.5 px-3 py-2" aria-hidden>
              <span className="size-2.5 rounded-full bg-[#FF5F57]" />
              <span className="size-2.5 rounded-full bg-[#FEBC2E]" />
              <span className="size-2.5 rounded-full bg-[#28C840]" />
              <span className="ml-3 font-mono text-[10px] text-[#9AA5B5]">equity.ai/dashboard</span>
            </div>
            <img
              src={heroShot}
              alt="Equity.AI dashboard — revenue, receivables, payables and invoice volume at a glance"
              className="block w-220 rounded-lg"
              loading="eager"
            />
          </div>

          <div
            data-parallax="-0.05"
            className="absolute -left-4 bottom-14 hidden rounded-xl border border-[#D8E1F0] bg-white px-4 py-3 shadow-[0_18px_40px_-18px_rgba(15,30,70,0.3)] md:block lg:-left-10"
          >
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#7A8699]">
              Revenue (YTD)
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-xl font-semibold" style={{ color: GREEN }}>
                $38,240.11
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#E7F6EE] px-2 py-0.5 text-[10px] font-semibold text-[#16A34A]">
                payments received
              </span>
            </div>
          </div>
          <div
            data-parallax="0.06"
            className="absolute -right-3 top-16 hidden rounded-xl border border-[#D8E1F0] bg-white px-4 py-3 shadow-[0_18px_40px_-18px_rgba(15,30,70,0.3)] md:block lg:-right-8"
          >
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#7A8699]">
              Cash coverage
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[#EDF0F5]">
                <div className="h-full rounded-full bg-[#F59E0B]" style={{ width: "100%" }} />
              </div>
              <span className="font-mono text-sm font-semibold" style={{ color: AMBER }}>
                100/100
              </span>
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── module ticker ——— */

function Ticker() {
  return (
    <div className="border-y border-[#E5E9F0] bg-white py-3.5 overflow-hidden" aria-hidden>
      <div className="flex w-max animate-[eq-tick_48s_linear_infinite] gap-10 pr-10">
        {[...MODULES, ...MODULES].map((m, i) => (
          <span
            key={i}
            className="whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.2em] text-[#8B95A7]"
          >
            {m}
            <span className="ml-10 text-[#D5DCE8]">◦</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────── problem band ——— */

function Problems() {
  return (
    <Section className="py-24 md:py-32">
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div className="max-w-2xl">
          <MicroLabel>Saturday, 11:42 PM</MicroLabel>
          <h2
            className="rv mt-3 text-balance text-[clamp(1.9rem,3.4vw,2.7rem)] font-bold leading-[1.1] tracking-[-0.03em]"
            style={{ color: INK }}
          >
            The month-end problem every SMB owner knows.
          </h2>
        </div>
        <p className="rv max-w-[42ch] text-[15px] leading-relaxed text-[#5B6578]">
          Revenues arrive, expenses scatter, and nobody can say — with confidence — how much you
          made or owe this month.
        </p>
      </div>

      <div className="mt-14 grid gap-5 lg:grid-cols-[1.15fr_0.85fr_0.85fr]">
        {/* featured card */}
        <div
          className="rv relative overflow-hidden rounded-2xl p-8 text-white shadow-[0_30px_60px_-24px_rgba(46,92,246,0.5)]"
          style={{ background: "linear-gradient(160deg,#2E5CF6 0%,#1D42C4 100%)" }}
        >
          <div
            aria-hidden
            className="absolute -right-10 -top-10 size-48 rounded-full bg-white/10 blur-2xl"
          />
          <div className="relative">
            <FileText className="size-6" aria-hidden />
            <h3 className="mt-5 text-xl font-bold tracking-tight">
              Bookkeeping done by hand, at night.
            </h3>
            <p className="mt-3 text-[14.5px] leading-relaxed text-white/75">
              Every invoice line re-typed into a spreadsheet. Every tax rate memorized.
              Reconciliation pushed to "after the weekend" — for six weekends straight.
            </p>
            <div className="mt-7 rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur">
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/60">
                Journal entry — manual
              </div>
              <div className="mt-2 grid grid-cols-[1fr_auto_auto] gap-x-6 font-mono text-[12px]">
                <span className="text-white/85">Cash ………</span>
                <span className="text-white/50">Dr</span>
                <span className="text-right text-white/85">$3,120.00</span>
                <span className="text-white/85">Sales ………</span>
                <span className="text-white/50">Cr</span>
                <span className="text-right text-white/50">$3,120.00</span>
              </div>
            </div>
          </div>
        </div>

        <div className="rv delay-1 rounded-2xl border border-[#E5E9F0] bg-white p-8">
          <div className="inline-flex items-center gap-2 rounded-lg bg-[#FDF3E3] px-2.5 py-1.5 text-amber-600">
            <TrendingUp className="size-4" aria-hidden />
          </div>
          <h3 className="mt-5 text-xl font-bold tracking-tight" style={{ color: INK }}>
            Cash-flow blind spots.
          </h3>
          <p className="mt-3 text-[14.5px] leading-relaxed text-[#5B6578]">
            The invoice you forgot for 45 days. The bill, paid twice. The customer quietly slipping
            from "partial" to "late" — visible only after it hurts.
          </p>
          <div className="mt-7 flex h-16 items-end gap-1.5" aria-hidden>
            {[38, 52, 44, 61, 49, 72, 58, 81, 66, 92].map((h, i) => (
              <span key={i} className="w-full rounded-t bg-[#EAF0FA]" style={{ height: `${h}%` }} />
            ))}
          </div>
          <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[#9AA5B5]">
            Receivables trending down by the week
          </div>
        </div>

        <div className="rv delay-2 rounded-2xl border border-[#E5E9F0] bg-white p-8">
          <div className="inline-flex items-center gap-2 rounded-lg bg-[#FEECEC] px-2.5 py-1.5 text-red-500">
            <ScrollText className="size-4" aria-hidden />
          </div>
          <h3 className="mt-5 text-xl font-bold tracking-tight" style={{ color: INK }}>
            Compliance at 2 AM.
          </h3>
          <p className="mt-3 text-[14.5px] leading-relaxed text-[#5B6578]">
            Output tax vs. input tax, reconstructed from three different folders, one day before the
            filing deadline. Missing vendor tax IDs. Exports that don't pass review.
          </p>
          <div className="mt-7 space-y-2" aria-hidden>
            {[
              ["Output tax collected", "$2,041.60", true],
              ["Input tax paid", "$1,733.25", true],
              ["Net liability", "$308.35", false],
            ].map(([label, val, ok]) => (
              <div
                key={String(label)}
                className="flex items-center justify-between rounded-lg bg-[#F6F8FC] px-3.5 py-2.5"
              >
                <span className="text-[12.5px] text-[#5B6578]">{label}</span>
                <span
                  className={`font-mono text-[12.5px] font-semibold ${ok ? "text-[#16A34A]" : "text-[#F59E0B]"}`}
                >
                  {val}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}

/* ───────────────────────────────────────────────────────────── bento modules ——— */

function Feature({
  icon,
  title,
  body,
  className = "",
}: {
  icon: ReactNode;
  title: string;
  body: string;
  className?: string;
}) {
  return (
    <div className={`rv rounded-2xl border border-[#E5E9F0] bg-white p-7 ${className}`}>
      <div className="inline-flex items-center gap-2 rounded-lg bg-[#EDF2FD] px-2.5 py-1.5 text-[#2E5CF6]">
        {icon}
      </div>
      <h3 className="mt-4 text-[17px] font-bold tracking-tight" style={{ color: INK }}>
        {title}
      </h3>
      <p className="mt-2 text-[14px] leading-relaxed text-[#5B6578]">{body}</p>
    </div>
  );
}

function Modules() {
  return (
    <div
      id="modules"
      className="border-y border-[#E5E9F0] bg-[#FAFBFE] py-24 md:py-32 scroll-mt-16"
    >
      <Section>
        <div className="mx-auto max-w-2xl text-center">
          <MicroLabel>18 modules · one workspace</MicroLabel>
          <h2
            className="rv mt-3 text-balance text-[clamp(1.9rem,3.4vw,2.7rem)] font-bold leading-[1.1] tracking-[-0.03em]"
            style={{ color: INK }}
          >
            All the pieces your back office needs, already connected.
          </h2>
          <p className="rv delay-1 mt-4 text-[15px] leading-relaxed text-[#5B6578]">
            Every module writes to the same double-entry ledger — so quotes become invoices,
            invoices post themselves, and your trial balance is always true.
          </p>
        </div>

        <div className="mt-16 grid gap-5 lg:grid-cols-12">
          <div className="rv group relative overflow-hidden rounded-2xl border border-[#E5E9F0] bg-white p-2 shadow-[0_30px_70px_-30px_rgba(15,30,70,0.25)] lg:col-span-8">
            <img
              src={heroShot}
              alt="Equity.AI overview dashboard"
              className="block w-full rounded-lg transition-transform duration-700 group-hover:scale-[1.015]"
              loading="lazy"
            />
            <div className="absolute left-7 top-7 inline-flex items-center gap-2 rounded-lg bg-[#0B1220]/85 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-white backdrop-blur">
              <span className="size-1.5 rounded-full bg-[#4ADE80]" /> Live dashboard
            </div>
          </div>

          <div className="rv delay-1 overflow-hidden rounded-2xl border border-[#E5E9F0] bg-white p-6 lg:col-span-4">
            <FeatureInline
              icon={<Wallet className="size-4" />}
              title="Money, end to end"
              body="Quotes → invoices → payments → credit notes. Trigger-based journal posting keeps the ledger balanced without you touching a debit."
            />
            <div className="mt-5 space-y-2" aria-hidden>
              {["Quotes", "Invoices", "Payments", "Credit Notes"].map((m, i) => (
                <div
                  key={m}
                  className="flex items-center justify-between rounded-lg border border-[#EDF0F5] px-3.5 py-2"
                >
                  <span className="text-[13px] font-medium text-[#3D485E]">{m}</span>
                  <span
                    className={`font-mono text-[11px] ${i === 3 ? "text-[#16A34A]" : "text-[#9AA5B5]"}`}
                  >
                    {["2 drafts", "16 issued", "15 received", "1 issued"][i]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rv overflow-hidden rounded-2xl border border-[#E5E9F0] bg-white p-2 shadow-[0_30px_70px_-30px_rgba(15,30,70,0.2)] lg:col-span-5">
            <img
              src={accountingShot}
              alt="Chart of accounts with typed account cards"
              className="block w-full rounded-lg"
              loading="lazy"
            />
          </div>

          <div className="rv delay-1 rounded-2xl border border-[#E5E9F0] bg-white p-7 lg:col-span-3">
            <FeatureInline
              icon={<Landmark className="size-4" />}
              title="Real accounting"
              body="Chart of accounts, journal entries, trial balance and P&L — US-GAAP or IFRS presets, country-aware."
            />
            <div className="mt-5 flex flex-wrap gap-1.5" aria-hidden>
              {["asset", "liability", "equity", "income", "expense"].map((t, i) => (
                <span
                  key={t}
                  className={`rounded-full px-2.5 py-1 font-mono text-[10px] ${["bg-[#E7F0FE] text-[#2E5CF6]", "bg-[#FEF3E7] text-[#D97706]", "bg-[#F3E8FF] text-[#8B5CF6]", "bg-[#E7F6EE] text-[#16A34A]", "bg-[#FDE8E8] text-[#DC2626]"][i]}`}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          <div className="rv delay-2 overflow-hidden rounded-2xl border border-[#E5E9F0] bg-white p-2 shadow-[0_30px_70px_-30px_rgba(15,30,70,0.2)] lg:col-span-4">
            <img
              src={complianceShot}
              alt="Compliance module — output vs input tax with filing ranges"
              className="block w-full rounded-lg"
              loading="lazy"
            />
          </div>

          <Feature
            className="rv delay-1 lg:col-span-4"
            icon={<ShieldCheck className="size-4" />}
            title="Compliance, boring again"
            body="Tax collected vs. paid per period, missing-tax-ID detection, and one-click CSV exports your accountant won't complain about."
          />
          <Feature
            className="rv delay-2 lg:col-span-4"
            icon={<BadgeCheck className="size-4" />}
            title="Inventory that reconciles"
            body="Multi-location stock, purchase orders, low-stock alerts — the Printer Ink you forgot to reorder shows up before it costs you."
          />
          <Feature
            className="rv delay-1 lg:col-span-4"
            icon={<Lock className="size-4" />}
            title="Secure by architecture"
            body="Per-workspace row-level security, service-role isolation for server tasks, invite-based teams with role checks."
          />

          <div className="rv overflow-hidden rounded-2xl border border-[#E5E9F0] bg-white p-2 shadow-[0_30px_70px_-30px_rgba(15,30,70,0.2)] lg:col-span-8">
            <img
              src={settingsShot}
              alt="Workspace settings — currency, country and tax regime"
              className="block w-full rounded-lg"
              loading="lazy"
            />
          </div>
          <Feature
            className="rv delay-1 lg:col-span-4"
            icon={<FileText className="size-4" />}
            title="Papers, not profiles"
            body="Workspace details flow straight into invoices, reports and PDF exports — set once, applied everywhere."
          />
        </div>
      </Section>
    </div>
  );
}

function FeatureInline({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div>
      <div className="inline-flex items-center gap-2 rounded-lg bg-[#EDF2FD] px-2.5 py-1.5 text-[#2E5CF6]">
        {icon}
      </div>
      <h3 className="mt-4 text-[17px] font-bold tracking-tight" style={{ color: INK }}>
        {title}
      </h3>
      <p className="mt-2 text-[14px] leading-relaxed text-[#5B6578]">{body}</p>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────── freya band ——— */

function Freya() {
  return (
    <div id="freya" className="relative overflow-hidden bg-[#0B1220] py-24 md:py-32 scroll-mt-16">
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(46,92,246,0.14) 1px,transparent 1px),linear-gradient(90deg,rgba(46,92,246,0.14) 1px,transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(ellipse 70% 80% at 70% 20%, black 20%, transparent 75%)",
        }}
      />
      <div
        aria-hidden
        className="absolute -right-40 top-0 size-[480px] rounded-full bg-[#2E5CF6]/25 blur-[140px]"
      />

      <Section className="relative grid items-center gap-14 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <div className="rv inline-flex items-center gap-2 rounded-full border border-white/15 px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-[#8FA8FF]">
            <BrainCircuit className="size-3.5" aria-hidden /> Freya — AI finance analyst
          </div>
          <h2 className="rv delay-1 mt-6 text-balance text-[clamp(2rem,3.8vw,3rem)] font-bold leading-[1.06] tracking-[-0.035em] text-white">
            Your live ledger finally talks back.
          </h2>
          <p className="rv delay-2 mt-5 max-w-[52ch] text-[15.5px] leading-[1.7] text-white/65">
            Freya reads your invoices, bills, expenses, inventory and journals — as they are right
            now. Ask about cash position, tax collected vs. paid, or which customer is quietly
            becoming your problem. Answers come with the numbers; you verify before acting.
          </p>
          <div className="rv delay-3 mt-8 space-y-2.5" role="list" aria-label="Example questions">
            {[
              "What's my current cash position and net P&L?",
              "Show me the 5 largest outstanding invoices.",
              "What tax did I collect vs pay this quarter?",
              "Which products are running low on stock?",
            ].map((qs) => (
              <div
                key={qs}
                role="listitem"
                className="group flex max-w-md items-center gap-3 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-[13.5px] text-white/80 transition-colors hover:border-[#2E5CF6]/50 hover:bg-white/[0.08] hover:text-white"
              >
                <span className="font-mono text-[10px] text-[#5A7BFF]">▲</span>
                {qs}
              </div>
            ))}
          </div>
          <p className="rv delay-4 mt-6 font-mono text-[11px] uppercase tracking-[0.14em] text-white/35">
            Freya reads your live ledger · verify before acting
          </p>
        </div>

        <div className="rv delay-2 h-96 relative">
          <div className="relative rounded-2xl border h-96 border-white/12 bg-white/[0.04] p-2 shadow-[0_50px_120px_-40px_rgba(0,20,80,0.7)]">
            <img
              src={freyaShot}
              alt="Freya AI analyst answering grounded finance questions inside Equity.AI"
              className="block w-full h-full rounded-xl"
              loading="lazy"
            />
          </div>
        </div>
      </Section>
    </div>
  );
}

/* ───────────────────────────────────────────────────────── ledger / demo ——— */

const LEDGER = [
  ["INV-0007", "Northwind Interiors", "PAID", "$384.63"],
  ["INV-0016", "Braavos Freight Co.", "OPEN", "$243.09"],
  ["EXP-0043", "Utilities · · Oct", "BOOKED", "$850.00"],
  ["BILL-0021", "Globex Paper Supply", "UNPAID", "$346.90"],
];

const SEEDED_FACTS = [
  { n: 16, suffix: "", label: "invoices — paid, partial & open" },
  { n: 30, suffix: "+", label: "expenses across 10 months" },
  { n: 4, suffix: "", label: "vendor bills, 2 already settled" },
  { n: 2, suffix: "", label: "warehouses with live stock" },
];

function LedgerDemo() {
  // count-up when visible
  const [seen, setSeen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const [counts, setCounts] = useState(SEEDED_FACTS.map(() => 0));
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!seen) return;
    const start = performance.now();
    const dur = 900;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / dur);
      setCounts(SEEDED_FACTS.map((f) => Math.round(f.n * (1 - Math.pow(1 - k, 3)))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [seen]);

  return (
    <div id="demo" className="py-24 md:py-32 scroll-mt-16">
      <Section>
        <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
          {/* ledger preview */}
          <div className="rv overflow-x-auto">
            <div className="min-w-[430px] rounded-2xl border border-[#E5E9F0] bg-white shadow-[0_40px_90px_-35px_rgba(15,30,70,0.28)] overflow-hidden sm:min-w-0">
              <div className="flex items-center justify-between border-b border-[#EDF0F5] px-6 py-4">
                <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#7A8699]">
                  Acme Trading Co. — seeded ledger
                </span>
                <span className="font-mono text-[11px] text-[#16A34A]">◉ balanced</span>
              </div>
              <table className="w-full font-mono text-[12.5px]">
                <thead>
                  <tr className="text-left text-[#9AA5B5]">
                    {["REF", "COUNTERPARTY", "STATUS", "AMOUNT"].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-[10px] font-medium uppercase tracking-[0.14em] sm:px-6"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {LEDGER.map(([ref, cp, st, amt], i) => (
                    <tr key={ref} className="border-t border-[#F0F3F8]">
                      <td className="px-4 py-3 text-[#0B1220] sm:px-6">{ref}</td>
                      <td className="px-4 py-3 text-[#5B6578] sm:px-6">{cp}</td>
                      <td className="px-4 py-3 sm:px-6">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${st === "OPEN" || st === "UNPAID" ? "bg-[#FEF3E7] text-[#D97706]" : "bg-[#E7F6EE] text-[#16A34A]"}`}
                        >
                          {st}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-[#0B1220] sm:px-6">
                        {amt}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="border-t border-[#EDF0F5] bg-[#FAFBFE] px-4 py-3.5 font-mono text-[11px] text-[#9AA5B5] sm:px-6">
                + 10 months of journal history, quotes, purchase orders, starter stock…
              </div>
            </div>
          </div>

          {/* copy + facts */}
          <div ref={boxRef}>
            <MicroLabel>The one-click demo</MicroLabel>
            <h2
              className="rv mt-3 text-balance text-[clamp(1.9rem,3.4vw,2.7rem)] font-bold leading-[1.1] tracking-[-0.03em]"
              style={{ color: INK }}
            >
              Open the whole application — already full of your (pretend) money.
            </h2>
            <p className="rv delay-1 mt-5 max-w-[54ch] text-[15.5px] leading-[1.7] text-[#5B6578]">
              One click signs you into a live, fully seeded workspace:{" "}
              <strong className="font-semibold text-[#0B1220]">Acme Trading Co.</strong>, with ten
              months of realistic history behind every dashboard, report and Freya answer. No signup
              form. No email verification. No fake screenshot tour — it's the real app.
            </p>
            <div className="rv delay-2 mt-8 grid grid-cols-2 gap-x-8 gap-y-6 md:grid-cols-2">
              {SEEDED_FACTS.map((f, i) => (
                <div key={f.label}>
                  <div
                    className="font-mono text-[30px] font-semibold leading-none"
                    style={{ color: INK }}
                  >
                    {counts[i]}
                    <span className="text-[#2E5CF6]">{f.suffix}</span>
                  </div>
                  <div className="mt-2 text-[13px] text-[#5B6578]">{f.label}</div>
                </div>
              ))}
            </div>
            <div className="rv delay-3 mt-9 flex flex-wrap items-center gap-3.5">
              <DemoButton variant="blue" label="Open the demo workspace" />
              <span className="font-mono text-[11px] uppercase tracking-[0.13em] text-[#7A8699]">
                creates the account for you → dashboard
              </span>
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── how it works ——— */

function Steps() {
  const steps = [
    {
      n: "01",
      t: "Launch the demo — or create a free account",
      d: "The demo provisions itself in seconds. Your own workspace spins up the same way, with your country, currency and tax regime preset.",
    },
    {
      n: "02",
      t: "Enter customers, products, and share the link",
      d: "Clean forms, sane defaults. Numbered documents, recurring invoice templates, and one-click PDF exports from day one.",
    },
    {
      n: "03",
      t: "Let the engine balance itself",
      d: "Invoices post journals automatically. Trial balance, P&L, tax returns and Freya's answers are always built on the live ledger.",
    },
  ];
  return (
    <div className="border-y border-[#E5E9F0] bg-[#FAFBFE] py-24 md:py-32">
      <Section>
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <MicroLabel>Three moves, one ledger</MicroLabel>
            <h2
              className="rv mt-3 text-balance text-[clamp(1.9rem,3.4vw,2.7rem)] font-bold leading-[1.1] tracking-[-0.03em]"
              style={{ color: INK }}
            >
              Get started, honestly, in three steps.
            </h2>
          </div>
        </div>
        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-[#E5E9F0] bg-[#E5E9F0] md:grid-cols-3">
          {steps.map((s, i) => (
            <div
              key={s.n}
              className={`rv ${i === 1 ? "delay-1" : i === 2 ? "delay-2" : ""} group bg-white p-8 transition-colors duration-300 hover:bg-[#FBFCFF]`}
            >
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-[13px] font-semibold text-[#2E5CF6]">{s.n}</span>
                <ArrowRight
                  className="size-4 text-[#C7CFDC] transition-all duration-300 group-hover:translate-x-1 group-hover:text-[#2E5CF6]"
                  aria-hidden
                />
              </div>
              <h3
                className="mt-5 text-[17px] font-bold leading-snug tracking-tight"
                style={{ color: INK }}
              >
                {s.t}
              </h3>
              <p className="mt-3 text-[14px] leading-relaxed text-[#5B6578]">{s.d}</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────── pricing ——— */

function Pricing() {
  const included = [
    "18 modules — quoting to compliance",
    "Freya AI analyst (beta) included",
    "Unlimited workspaces & team members",
    "Double-entry ledger + P&L, trial balance",
    "Country tax presets & CSV exports",
    "PDF invoices, quotes and POs",
  ];
  return (
    <Section className="py-24 md:py-28">
      <div className="grid items-stretch gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rv">
          <MicroLabel>Pricing</MicroLabel>
          <h2
            className="rv mt-3 text-balance text-[clamp(1.9rem,3.4vw,2.7rem)] font-bold leading-[1.1] tracking-[-0.03em]"
            style={{ color: INK }}
          >
            One plan. It's free while we're in beta.
          </h2>
          <p className="rv delay-1 mt-4 max-w-[48ch] text-[15px] leading-relaxed text-[#5B6578]">
            We'd rather build with real ledgers than demo videos. Everything below costs you $0
            today — no card, no trial countdown.
          </p>
        </div>
        <div className="rv delay-1 relative overflow-hidden rounded-2xl border border-[#0B1220]/15 bg-white p-8 shadow-[0_40px_90px_-40px_rgba(15,30,70,0.35)]">
          <div
            aria-hidden
            className="absolute right-0 top-0 h-full w-1.5 bg-gradient-to-b from-[#2E5CF6] to-[#0B1220]"
          />
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <div>
              <div className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#7A8699]">
                Beta plan
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span
                  className="font-mono text-[52px] font-semibold leading-none"
                  style={{ color: INK }}
                >
                  $0
                </span>
                <span className="text-[14px] text-[#5B6578]">forever, while in beta</span>
              </div>
            </div>
            <Link
              to="/login"
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#0B1220] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#2E5CF6]"
            >
              Create free account <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          <ul className="mt-8 grid gap-2.5 sm:grid-cols-2">
            {included.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-[14px] text-[#3D485E]">
                <CheckCheck className="mt-0.5 size-4 shrink-0 text-[#16A34A]" aria-hidden /> {f}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}

/* ─────────────────────────────────────────────────────────────────── FAQ ——— */

const FAQS = [
  {
    q: "Is the live demo really the full application?",
    a: "Yes. One click signs you into Equity.AI with a seeded workspace — Acme Trading Co. — containing ten months of invoices, payments, expenses, vendor bills, quotes, purchase orders and journals. You can open dashboards, run reports, ask Freya, edit documents, everything a paying user can do.",
  },
  {
    q: "Is Equity.AI actually free?",
    a: "Right now, yes — every module is $0 while we're in beta. We use the period to refine the product with real ledgers. You will always be told, with notice, before anything changes.",
  },
  {
    q: "What happens to my own data after I create a free account?",
    a: "You get your own workspace with sane defaults: country, currency and tax regime presets, a chart of accounts and numbered documents. Your data lives only in your row-level-security-isolated workspace — never shared across customers.",
  },
  {
    q: "How does Freya work with my data?",
    a: "Freya is powered by an LLM that can only reach your workspace through server-side tools that read your live ledger — invoices, bills, expenses, inventory and journals. She answers from the numbers, every answer cites actual ledger data, and we recommend you verify before acting.",
  },
  {
    q: "Can books survive an audit?",
    a: "Every business document is backed by double-entry journal postings that stay balanced by database trigger — debits must equal credits, no exceptions. Tax summaries and ledger exports are produced as CSV/PDF for filing.",
  },
  {
    q: "What accounting standards and countries are supported?",
    a: "Workspaces are country-aware: US (GAAP), UK, EU and more presets set currency and tax behavior. The chart of accounts, P&L and trial balance follow standard conventions regardless of locale.",
  },
];

function Faq() {
  return (
    <div id="faq" className="border-t border-[#E5E9F0] bg-[#FAFBFE] py-24 md:py-32 scroll-mt-16">
      <Section className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <MicroLabel>Questions you asked us</MicroLabel>
          <h2
            className="rv mt-3 text-balance text-[clamp(1.9rem,3.4vw,2.7rem)] font-bold leading-[1.1] tracking-[-0.03em]"
            style={{ color: INK }}
          >
            Frequently asked, plainly answered.
          </h2>
          <p className="rv delay-1 mt-4 max-w-[40ch] text-[15px] leading-relaxed text-[#5B6578]">
            Couldn't find yours? The demo is the fastest way to check anything yourself.
          </p>
        </div>
        <Accordion.Root type="single" collapsible className="rv">
          {FAQS.map((f, i) => (
            <Accordion.Item
              key={f.q}
              value={`q${i}`}
              className={`border-b border-[#E5E9F0] ${i === 0 ? "border-t" : ""}`}
            >
              <Accordion.Trigger className="group flex w-full items-center justify-between gap-6 py-5 text-left">
                <span className="text-[16px] font-semibold tracking-tight text-[#0B1220] group-hover:text-[#2E5CF6] transition-colors">
                  {f.q}
                </span>
                <span
                  className="flex size-7 shrink-0 items-center justify-center rounded-full border border-[#E5E9F0] font-mono text-sm text-[#7A8699] transition-all duration-300 group-data-[state=open]:rotate-45 group-data-[state=open]:border-[#2E5CF6] group-data-[state=open]:text-[#2E5CF6]"
                  aria-hidden
                >
                  +
                </span>
              </Accordion.Trigger>
              <Accordion.Content className="overflow-hidden data-[state=closed]:animate-[eq-fold_0.25s_ease-out_revert]">
                <p className="max-w-[68ch] pb-6 text-[14.5px] leading-[1.7] text-[#5B6578]">
                  {f.a}
                </p>
              </Accordion.Content>
            </Accordion.Item>
          ))}
        </Accordion.Root>
      </Section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────── closing CTA + footer ——— */

function ClosingAndFooter() {
  return (
    <>
      <div className="bg-[#0B1220] py-24 md:py-28">
        <Section className="text-center">
          <div aria-hidden className="absolute" />
          <h2 className="rv mx-auto max-w-[22ch] text-balance text-[clamp(2.2rem,4.2vw,3.4rem)] font-bold leading-[1.05] tracking-[-0.04em] text-white">
            Your ledger deserves a voice.
          </h2>
          <p className="rv delay-1 mx-auto mt-5 max-w-[52ch] text-[15.5px] leading-relaxed text-white/60">
            Open the seeded demo with one click, or start your own free workspace. Either way —
            you'll be inside the real thing in under a minute.
          </p>
          <div className="rv delay-2 mt-9 flex flex-wrap items-center justify-center gap-3.5">
            <DemoButton variant="blue" label="Launch the live demo" />
            <Link
              to="/login"
              className="inline-flex h-12 items-center rounded-xl border border-white/20 px-6 text-[15px] font-semibold text-white transition-colors hover:bg-white/10"
            >
              Create free account
            </Link>
          </div>
          <div className="rv delay-3 mt-10 flex items-center justify-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-white/35">
            <span className="size-1.5 rounded-full bg-[#4ADE80]" /> All systems operational
          </div>
        </Section>
      </div>

      <footer className="border-t border-[#E5E9F0] bg-white py-14">
        <Section className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <LogoMark />
              <span className="font-extrabold tracking-tight text-[16px]" style={{ color: INK }}>
                EQUITY<span className="text-[#2E5CF6]">.AI</span>
              </span>
            </div>
            <p className="mt-4 max-w-[34ch] text-[13.5px] leading-relaxed text-[#5B6578]">
              AI-powered ERP & accounting for small and medium businesses. Reference architecture —
              built on Supabase, RLS-first, servers run their own checks.
            </p>
          </div>
          {[
            ["Product", ["Live demo", "Modules", "Freya AI", "Beta plan"]],
            ["Resources", ["FAQ", "How-to setup", "Changelog"]],
            ["Company", ["Log in", "Create account", "License note", "Contact"]],
          ].map(([title, items]) => (
            <div key={String(title)}>
              <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#9AA5B5]">
                {title}
              </div>
              <ul className="mt-4 space-y-2.5">
                {(items as string[]).map((it) => (
                  <li key={it}>
                    {it === "Live demo" ? (
                      <a
                        href="#demo"
                        className="text-[13.5px] text-[#3D485E] hover:text-[#2E5CF6] transition-colors"
                      >
                        {it}
                      </a>
                    ) : it === "Log in" || it === "Create account" ? (
                      <Link
                        to="/login"
                        className="text-[13.5px] text-[#3D485E] hover:text-[#2E5CF6] transition-colors"
                      >
                        {it}
                      </Link>
                    ) : (
                      <a
                        href={`#${String(title) === "Product" ? "modules" : String(title) === "Resources" ? "faq" : "demo"}`}
                        className="text-[13.5px] text-[#3D485E] hover:text-[#2E5CF6] transition-colors"
                      >
                        {it}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Section>
        <Section>
          <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-[#F0F3F8] pt-6 font-mono text-[11px] uppercase tracking-[0.14em] text-[#9AA5B5]">
            <span>© {new Date().getFullYear()} Equity.AI — free during beta</span>
            <span>Double-entry · RLS-first · Trigger-audited</span>
          </div>
        </Section>
      </footer>
    </>
  );
}

/* ═════════════════════════════════════════════════════════════════ page ═══ */

export default function Landing() {
  useReveal();
  useParallax();
  return (
    <div
      className="min-h-screen bg-white text-[#0B1220]"
      style={{ fontFeatureSettings: "'cv11','ss01'" }}
    >
      <style>{`
        @keyframes eq-tick { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes eq-fold { from { height: var(--radix-accordion-content-height); } to { height: 0; } }
        .rv { opacity: 0; transform: translateY(22px); transition: opacity .8s cubic-bezier(.16,1,.3,1), transform .8s cubic-bezier(.16,1,.3,1); transition-delay: calc(var(--d, 0ms)); }
        .rv.rv-in, .rv.delay-0.rv-in { opacity: 1; transform: none; }
        .delay-0 { --d: 0ms } .delay-1 { --d: 110ms } .delay-2 { --d: 220ms } .delay-3 { --d: 330ms } .delay-4 { --d: 440ms }
        @media (prefers-reduced-motion: reduce) {
          .rv { opacity: 1 !important; transform: none !important; transition: none !important; }
          [data-parallax] { transform: none !important; }
        }
      `}</style>

      {/* stagger wiring: .rv elements with .delay-N get their delay from the class above */}
      <Nav />
      <main>
        <Hero />
        <Ticker />
        <Problems />
        <Modules />
        <Freya />
        <LedgerDemo />
        <Steps />
        <Pricing />
        <Faq />
        <ClosingAndFooter />
      </main>
    </div>
  );
}
