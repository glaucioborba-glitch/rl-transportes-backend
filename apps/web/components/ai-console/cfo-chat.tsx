"use client";

import { AiConsoleChat } from "@/components/ai-console/ai-console-chat";

type CfoChatProps = {
  onAsk: (question: string) => { text: string; priority: "P1" | "P2" | "P3" };
};

export function CfoChat({ onAsk }: CfoChatProps) {
  return (
    <AiConsoleChat
      title="Pergunte à finança"
      placeholder="Ex.: Qual meu risco de inadimplência?"
      onAsk={onAsk}
      className="min-h-[360px]"
    />
  );
}
