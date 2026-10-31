import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { useOrg } from "@/contexts/org-context";
import { supabase } from "@/integrations/supabase/client";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, Wrench } from "lucide-react";
import { toast } from "sonner";
import freyaLogo from "@/assets/freya.png";

export const Route = createFileRoute("/_authenticated/ai-agent")({
  head: () => ({ meta: [{ title: "Freya — AI Finance Analyst" }] }),
  component: AgentPage,
});

const SUGGESTIONS = [
  "What's my current cash position and net P&L?",
  "Show me the 5 largest outstanding invoices.",
  "What tax did I collect vs pay this quarter?",
  "Which products are running low on stock?",
];

function AgentPage() {
  const { currentOrg } = useOrg();
  const [token, setToken] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setToken(data.session?.access_token ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) =>
      setToken(s?.access_token ?? null),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  // Refs let the transport read the *current* token/org at request time.
  // useChat keeps the transport instance it was created with, so passing token
  // directly (or recreating via useMemo on token change) left requests without
  // the Authorization header when the session resolved after mount → 401.
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const orgIdRef = useRef(currentOrg?.id ?? null);
  orgIdRef.current = currentOrg?.id ?? null;

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: (): Record<string, string> => {
          const t = tokenRef.current;
          return t ? { Authorization: `Bearer ${t}` } : {};
        },
        body: () => ({ organizationId: orgIdRef.current }),
      }),
    [],
  );

  const { messages, sendMessage, status } = useChat({
    id: currentOrg?.id ?? "default",
    transport,
    // Static deployments have no /api/chat route (TanStack server functions are
    // not served on Hostinger/Netlify/Vercel static hosts) — surface it instead
    // of failing silently.
    onError: (error: Error | { message?: string }) => {
      const msg =
        typeof error?.message === "string" ? error.message : "Freya could not be reached.";
      toast.error(
        /404|not found|failed to fetch/i.test(msg)
          ? "Freya needs a server deployment (HowToSetup targets A–C). AI chat is unavailable on static hosting."
          : msg,
      );
    },
  });

  const [input, setInput] = useState("");
  const isBusy = status === "submitted" || status === "streaming";

  useEffect(() => {
    textareaRef.current?.focus();
  }, [status]);

  const submit = (text: string) => {
    if (!text.trim() || isBusy || !currentOrg) return;
    sendMessage({ text: text.trim() });
    setInput("");
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)]">
      <div className="border-b border-border px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={freyaLogo} alt="Freya" width={36} height={36} className="rounded-md" />
          <div>
            <h1 className="font-bold tracking-tight">Freya</h1>
            <p className="text-xs text-muted-foreground">
              AI finance analyst · Grounded in your live data
            </p>
          </div>
        </div>
        <Badge variant="outline" className="font-mono text-[10px]">
          {currentOrg?.name ?? "—"}
        </Badge>
      </div>

      <Conversation className="flex-1">
        <ConversationContent className="max-w-3xl mx-auto w-full">
          {messages.length === 0 && (
            <div className="flex flex-col items-center text-center py-16">
              <img src={freyaLogo} alt="" width={80} height={80} className="mb-4 opacity-80" />
              <h2 className="text-2xl font-bold tracking-tight mb-2">Ask Freya anything.</h2>
              <p className="text-muted-foreground max-w-md mb-8">
                She can analyze your invoices, bills, expenses, inventory and tax position in real
                time.
              </p>
              <div className="grid grid-cols-2 gap-2 w-full max-w-xl">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => submit(s)}
                    className="text-left text-sm p-3 rounded-md border border-border hover:border-accent hover:bg-accent/5 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <Message key={m.id} from={m.role}>
              <MessageContent className={m.role === "assistant" ? "bg-transparent p-0" : undefined}>
                {m.parts.map((part, i) => {
                  if (part.type === "text") {
                    return m.role === "assistant" ? (
                      <MessageResponse key={i}>{part.text}</MessageResponse>
                    ) : (
                      <div key={i} className="whitespace-pre-wrap">
                        {part.text}
                      </div>
                    );
                  }
                  if (part.type.startsWith("tool-")) {
                    const tp = part as {
                      type: string;
                      toolName?: string;
                      state?: string;
                      input?: unknown;
                      output?: unknown;
                      errorText?: string;
                    };
                    const name = tp.toolName ?? part.type.replace("tool-", "");
                    const state = tp.state ?? "input-streaming";
                    return (
                      <details
                        key={i}
                        className="my-2 text-xs rounded-md border border-border bg-muted/30 overflow-hidden"
                      >
                        <summary className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/50">
                          <Wrench className="size-3.5 text-accent" />
                          <span className="font-mono">{name}</span>
                          <span
                            className={`ml-auto text-[10px] uppercase tracking-wider ${state === "output-available" ? "text-success" : state === "output-error" ? "text-destructive" : "text-muted-foreground"}`}
                          >
                            {state.replace("-", " ")}
                          </span>
                          <ChevronDown className="size-3" />
                        </summary>
                        <div className="px-3 py-2 border-t border-border space-y-2">
                          {tp.input ? (
                            <div>
                              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                                Input
                              </div>
                              <pre className="font-mono text-[11px] overflow-x-auto">
                                {JSON.stringify(tp.input, null, 2)}
                              </pre>
                            </div>
                          ) : null}
                          {tp.output ? (
                            <div>
                              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                                Output
                              </div>
                              <pre className="font-mono text-[11px] overflow-x-auto max-h-64">
                                {JSON.stringify(tp.output, null, 2)}
                              </pre>
                            </div>
                          ) : null}
                          {tp.errorText ? (
                            <div className="text-destructive">{tp.errorText}</div>
                          ) : null}
                        </div>
                      </details>
                    );
                  }
                  return null;
                })}
              </MessageContent>
            </Message>
          ))}

          {status === "submitted" && <Shimmer>Thinking…</Shimmer>}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t border-border p-4 max-w-3xl mx-auto w-full">
        <PromptInput
          onSubmit={(_, e) => {
            e.preventDefault();
            submit(input);
          }}
        >
          <PromptInputTextarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about revenue, AR/AP, tax, inventory…"
            disabled={!currentOrg}
          />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={status} disabled={!input.trim() || isBusy || !currentOrg} />
          </PromptInputFooter>
        </PromptInput>
        <p className="text-[10px] text-muted-foreground mt-2 text-center">
          Freya reads your live ledger. Verify before acting on outputs.
        </p>
      </div>
    </div>
  );
}
