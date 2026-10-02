"use client";

import { useCallback, useEffect, useState } from "react";
import { Fingerprint, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  deleteMotoristaBiometria,
  getMotoristaBiometria,
  putMotoristaBiometria,
} from "@/lib/api/motorista-biometria-client";
import { enrollBioAgent, probeBioAgent, verifyBioAgent } from "@/lib/biometria/bio-agent-client";
import { ApiError } from "@/lib/api/staff-client";
import { toast } from "@/lib/toast";

type Props = {
  cpf: string;
  variant: "cadastro" | "ric";
  onRicVerified?: (ok: boolean) => void;
};

export function MotoristaDigitalPanel({ cpf, variant, onRicVerified }: Props) {
  const digits = cpf.replace(/\D/g, "");
  const cpfOk = digits.length === 11;
  const [agentOk, setAgentOk] = useState<boolean | null>(null);
  const [agentErr, setAgentErr] = useState<string | null>(null);
  const [enrolled, setEnrolled] = useState(false);
  const [enrolledAt, setEnrolledAt] = useState<string | null>(null);
  const [firText, setFirText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [matched, setMatched] = useState<boolean | null>(null);

  const refresh = useCallback(async () => {
    const health = await probeBioAgent();
    setAgentOk(health.ok);
    setAgentErr(health.ok ? null : health.error || "Agente do leitor parado.");
    if (!cpfOk) {
      setEnrolled(false);
      setFirText(null);
      return;
    }
    try {
      const st = await getMotoristaBiometria(digits);
      setEnrolled(st.enrolled);
      setEnrolledAt(st.enrolledAt);
      setFirText(st.firText);
    } catch {
      setEnrolled(false);
      setFirText(null);
    }
  }, [cpfOk, digits]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function cadastrar() {
    if (!cpfOk) {
      toast.error("Informe um CPF válido antes de cadastrar a digital.");
      return;
    }
    setBusy(true);
    try {
      const fir = await enrollBioAgent();
      await putMotoristaBiometria(digits, fir);
      toast.success("Digital cadastrada neste CPF.");
      setMatched(null);
      onRicVerified?.(false);
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiError || e instanceof Error ? e.message : "Falha ao cadastrar.");
    } finally {
      setBusy(false);
    }
  }

  async function conferirRic() {
    if (!firText) {
      toast.error("Cadastre a digital deste motorista antes de conferir.");
      return;
    }
    setBusy(true);
    try {
      const ok = await verifyBioAgent(firText);
      setMatched(ok);
      onRicVerified?.(ok);
      if (ok) toast.success("Digital bateu. Pode emitir a RIC.");
      else toast.error("Digital não bateu com o cadastro deste CPF.");
    } catch (e) {
      setMatched(false);
      onRicVerified?.(false);
      toast.error(e instanceof Error ? e.message : "Falha na conferência.");
    } finally {
      setBusy(false);
    }
  }

  async function recadastrar() {
    if (!cpfOk) return;
    setBusy(true);
    try {
      if (enrolled) await deleteMotoristaBiometria(digits);
      const fir = await enrollBioAgent();
      await putMotoristaBiometria(digits, fir);
      toast.success("Digital recadastrada.");
      setMatched(null);
      onRicVerified?.(false);
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiError || e instanceof Error ? e.message : "Falha ao recadastrar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex items-start gap-2">
        <Fingerprint className="mt-0.5 h-5 w-5 text-primary" />
        <div>
          <p className="font-medium">Impressão digital</p>
          <p className="text-xs text-muted-foreground">
            Leitor no PC do Gate (HFDU06R). Conferência 1:1 pelo CPF — não usa o software de ponto.
          </p>
        </div>
      </div>
      {!cpfOk ? (
        <p className="text-sm text-amber-200">CPF do motorista é obrigatório.</p>
      ) : null}
      {agentOk === false ? (
        <div className="space-y-2">
          <p className="text-sm text-amber-200">{agentErr}</p>
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void refresh()}>
            Tentar de novo
          </Button>
        </div>
      ) : null}
      {agentOk && enrolled ? (
        <p className="text-sm text-emerald-300">
          Digital cadastrada
          {enrolledAt
            ? ` em ${new Date(enrolledAt).toLocaleString("pt-BR")}`
            : ""}
          .
        </p>
      ) : null}
      {agentOk && cpfOk && !enrolled ? (
        <p className="text-sm text-muted-foreground">Ainda não há digital neste CPF.</p>
      ) : null}
      {matched === true ? (
        <p className="text-sm font-medium text-emerald-300">Conferência: bateu.</p>
      ) : null}
      {matched === false ? (
        <p className="text-sm font-medium text-red-300">Conferência: não bateu.</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {cpfOk && agentOk && !enrolled ? (
          <Button type="button" size="sm" disabled={busy} onClick={() => void cadastrar()}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Cadastrar digital
          </Button>
        ) : null}
        {cpfOk && agentOk && enrolled && variant === "ric" ? (
          <Button type="button" size="sm" disabled={busy} onClick={() => void conferirRic()}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Coletar digital para assinar
          </Button>
        ) : null}
        {cpfOk && agentOk && enrolled ? (
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void recadastrar()}>
            Recadastrar
          </Button>
        ) : null}
      </div>
    </div>
  );
}
