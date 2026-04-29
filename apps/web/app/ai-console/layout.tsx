import { AiConsoleShell } from "@/components/ai-console/ai-console-shell";

export default function AiConsoleLayout({ children }: { children: React.ReactNode }) {
  return <AiConsoleShell>{children}</AiConsoleShell>;
}
