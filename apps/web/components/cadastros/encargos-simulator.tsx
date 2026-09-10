"use client";

import { useEffect, useState } from "react";
import { Calculator, Loader2, Play, Save } from "lucide-react";
import { FormField, FormSection } from "@/components/cadastros/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/staff-client";
import {
  gerarEmpresaEncargosAgora,
  simularEmpresaEncargos,
  type EncargosSnapshot,
} from "@/lib/api/empresa-client";
import { formatBRL } from "@/lib/financeiro/format";
import { toast } from "@/lib/toast";

function competenciaMesAnterior() {
  const n = new Date();
  const d = new Date(n.getFullYear(), n.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function competenciaAtual() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
}

function origemLabel(h: EncargosSnapshot) {
  if (h.geradoPor === "PREVIA" || h.parcial) return "prévia";
  if (h.geradoPor === "CRON") return "automático";
  if (h.geradoPor === "USUARIO") return "manual";
  return null;
}

type Props = {
  canEdit?: boolean;
  historicoInicial?: EncargosSnapshot[];
};

export function EncargosSimulator({ canEdit = true, historicoInicial = [] }: Props) {
  const [competencia, setCompetencia] = useState(competenciaMesAnterior);
  const [receitaManual, setReceitaManual] = useState("");
  const [resultado, setResultado] = useState<EncargosSnapshot | null>(null);
  const [historico, setHistorico] = useState<EncargosSnapshot[]>(historicoInicial);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setHistorico(historicoInicial);
  }, [historicoInicial]);

  async function rodar(salvar: boolean) {
    setBusy(true);
    try {
      const manual = receitaManual.trim() ? Number(receitaManual.replace(",", ".")) : undefined;
      const out = await simularEmpresaEncargos({
        competencia,
        receitaManual: Number.isFinite(manual) ? manual : undefined,
        salvar,
      });
      setResultado(out);
      if (out.historico) setHistorico(out.historico);
      toast.success(
        salvar
          ? `Provisão de ${formatBRL(out.total)} gravada para ${out.competencia}.`
          : `Simulação: ${formatBRL(out.total)} (${out.cargaEfetivaPct}% da receita).`,
      );
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível simular.");
    } finally {
      setBusy(false);
    }
  }

  async function gerarAgora() {
    setBusy(true);
    try {
      const out = await gerarEmpresaEncargosAgora();
      setCompetencia(out.competencia || competenciaAtual());
      setReceitaManual("");
      setResultado(out);
      if (out.historico) setHistorico(out.historico);
      if (out.skipped) {
        toast.message(
          `Este mês já tem provisão gravada (${formatBRL(out.total)}). Use Gravar provisão para substituir.`,
        );
      } else {
        toast.success(
          `Prévia de ${formatBRL(out.total)} com ${out.qtdFaturas} fatura(s) de ${out.competencia} — parcial até o dia 1.`,
        );
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível gerar a prévia.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormSection title="Simulador de encargos" icon={Calculator}>
      <p className="mb-4 text-xs text-muted-foreground">
        <strong>Gerar agora</strong> atualiza a prévia do mês corrente com as faturas já emitidas.
        O cron do dia 1 fecha o mês anterior e substitui essa prévia. Simular / Gravar servem para
        cenário. Não vira boleto nem conta a pagar até confirmar a guia.
      </p>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button type="button" disabled={!canEdit || busy} onClick={() => void gerarAgora()}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
          Gerar agora
        </Button>
        <span className="text-xs text-muted-foreground">
          Prévia de {competenciaAtual()} — pode rodar quantas vezes quiser neste mês.
        </span>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <FormField label="Competência">
          <Input
            type="month"
            value={competencia}
            onChange={(e) => setCompetencia(e.target.value)}
            disabled={!canEdit || busy}
          />
        </FormField>
        <FormField label="Receita manual (opcional)">
          <Input
            type="number"
            min={0}
            step={0.01}
            placeholder="Deixe vazio para usar as faturas do mês"
            value={receitaManual}
            onChange={(e) => setReceitaManual(e.target.value)}
            disabled={!canEdit || busy}
          />
        </FormField>
        <div className="flex items-end gap-2">
          <Button type="button" variant="outline" disabled={!canEdit || busy} onClick={() => void rodar(false)}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}
            Simular
          </Button>
          <Button type="button" disabled={!canEdit || busy} onClick={() => void rodar(true)}>
            <Save className="mr-2 h-4 w-4" />
            Gravar provisão
          </Button>
        </div>
      </div>

      {resultado ? (
        <div className="mt-5 space-y-3">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label="Receita base" value={formatBRL(resultado.receita)} />
            <Kpi
              label="Origem"
              value={
                resultado.origemReceita === "FATURAS"
                  ? `${resultado.qtdFaturas} fatura(s)`
                  : "Valor informado"
              }
            />
            <Kpi
              label="Encargos"
              value={formatBRL(resultado.total)}
              destaque
              nota={resultado.parcial ? "parcial" : undefined}
            />
            <Kpi label="Carga efetiva" value={`${resultado.cargaEfetivaPct.toFixed(2)}%`} />
          </div>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-1.5 font-medium">Encargo</th>
                <th className="py-1.5 font-medium">Alíquota</th>
                <th className="py-1.5 text-right font-medium">Valor</th>
              </tr>
            </thead>
            <tbody>
              {resultado.linhas.map((l) => (
                <tr key={l.codigo} className={l.entraNaSoma ? "" : "text-muted-foreground"}>
                  <td className="py-1.5">
                    {l.label}
                    {l.nota ? <span className="ml-2 text-[11px] opacity-70">{l.nota}</span> : null}
                  </td>
                  <td className="py-1.5 tabular-nums">{l.aliquotaPct.toFixed(2)}%</td>
                  <td className="py-1.5 text-right tabular-nums">
                    {l.entraNaSoma ? formatBRL(l.valor) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border font-semibold">
                <td className="pt-2">Total da provisão</td>
                <td />
                <td className="pt-2 text-right tabular-nums">{formatBRL(resultado.total)}</td>
              </tr>
            </tfoot>
          </table>
          {resultado.avisos.map((a) => (
            <p key={a} className="text-[11px] text-amber-200/80">
              {a}
            </p>
          ))}
        </div>
      ) : null}

      {historico.length > 0 ? (
        <div className="mt-6">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Provisões gravadas
          </p>
          <ul className="space-y-1.5 text-sm">
            {historico.map((h) => (
              <li
                key={h.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2"
              >
                <span>
                  {h.competencia} · {h.empresa || "Empresa"} · {h.qtdFaturas} fatura(s)
                  {origemLabel(h) ? (
                    <span className="ml-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                      {origemLabel(h)}
                    </span>
                  ) : null}
                </span>
                <span className="tabular-nums text-amber-200">{formatBRL(h.total)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </FormSection>
  );
}

function Kpi({
  label,
  value,
  destaque,
  nota,
}: {
  label: string;
  value: string;
  destaque?: boolean;
  nota?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-[#0b0d12] px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold ${destaque ? "text-amber-200" : ""}`}>{value}</p>
      {nota ? <p className="text-[11px] text-amber-200/70">{nota}</p> : null}
    </div>
  );
}
