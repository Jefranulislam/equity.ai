import { Sparkles } from "lucide-react";

export function ModulePlaceholder({ title, description, phase }: { title: string; description: string; phase: number }) {
  return (
    <div className="p-8 max-w-5xl mx-auto w-full animate-reveal">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">{title}</h1>
          <p className="text-muted-foreground">{description}</p>
        </div>
        <span className="px-2.5 py-1 rounded-full bg-accent/5 text-accent text-[11px] font-bold uppercase tracking-wider">
          Phase {phase}
        </span>
      </div>

      <div className="border border-dashed border-border rounded-xl p-12 bg-sidebar/50 text-center">
        <div className="size-10 rounded-full bg-accent/5 mx-auto mb-4 flex items-center justify-center">
          <Sparkles className="size-5 text-accent" />
        </div>
        <h2 className="font-bold text-lg mb-1">Module scaffolded</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          The route, navigation, and design system are wired. The module ships in Phase {phase} of the build plan.
        </p>
      </div>
    </div>
  );
}
