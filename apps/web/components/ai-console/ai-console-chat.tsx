"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type AiChatMessage = { role: "user" | "assistant"; text: string; priority?: "P1" | "P2" | "P3" };

type AiConsoleChatProps = {
  title: string;
  placeholder: string;
  onAsk: (question: string) => { text: string; priority: "P1" | "P2" | "P3" };
  className?: string;
};

export function AiConsoleChat({ title, placeholder, onAsk, className }: AiConsoleChatProps) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<AiChatMessage[]>([]);

  const send = useCallback(() => {
    const q = input.trim();
    if (!q) return;
    const res = onAsk(q);
    setMessages((m) => [...m, { role: "user", text: q }, { role: "assistant", text: res.text, priority: res.priority }]);
    setInput("");
  }, [input, onAsk]);

  return (
    <div className={cn("flex flex-col rounded-2xl border border-violet-500/20 bg-[#0c0820]/90", className)}>
      <div className="border-b border-white/5 px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-violet-300/80">{title}</p>
      </div>
      <div className="max-h-[320px] min-h-[200px] space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="text-xs text-zinc-500">Digite uma pergunta operacional — o motor interpreta dados já carregados (sem LLM externo).</p>
        ) : null}
        {messages.map((msg, i) => (
          <div
            key={`${i}-${msg.text.slice(0, 12)}`}
            className={cn(
              "rounded-xl px-3 py-2 text-sm",
              msg.role === "user" ? "ml-6 bg-violet-950/40 text-violet-100" : "mr-6 border border-white/5 bg-black/30 text-zinc-200",
            )}
          >
            {msg.role === "assistant" && msg.priority ? (
              <span className="mb-1 inline-block rounded bg-white/10 px-1.5 font-mono text-[10px] text-amber-200/90">{msg.priority}</span>
            ) : null}
            {msg.role === "assistant" && msg.priority ? <br /> : null}
            {msg.text}
          </div>
        ))}
      </div>
      <div className="flex gap-2 border-t border-white/5 p-3">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          className="border-violet-500/20 bg-black/40 text-sm"
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), send())}
        />
        <Button type="button" onClick={send} className="shrink-0 bg-violet-600 hover:bg-violet-500">
          Enviar
        </Button>
      </div>
    </div>
  );
}
