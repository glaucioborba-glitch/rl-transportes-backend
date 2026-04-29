"use client";

import { AiConsoleChat } from "@/components/ai-console/ai-console-chat";

type StrategicChatProps = {
  onAsk: (question: string) => { text: string; priority: "P1" | "P2" | "P3" };
};

export function StrategicChat({ onAsk }: StrategicChatProps) {
  return (
    <AiConsoleChat
      title="Pergunte à diretoria"
      placeholder="Ex.: Quando ampliar o pátio?"
      onAsk={onAsk}
    />
  );
}
