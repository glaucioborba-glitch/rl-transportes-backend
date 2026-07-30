"use client";

import { useEffect, useState } from "react";
import { DollarSign, Loader2, Save } from "lucide-react";
import { ReguaCobrancaForm } from "@/components/cadastros/regua-cobranca-form";
import { FormField, FormSection } from "@/components/cadastros/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useParametrosGerais } from "@/hooks/use-parametros-gerais";
import { canDo, type CadastrosUserContext } from "@/lib/cadastros/permission-matrix";
import { OPCOES_CONDICAO_PAGAMENTO } from "@/lib/condicao-pagamento-portal";
import { listCadastrosTabelasPrecos } from "@/lib/api/cadastros-tabelas-precos-client";
import type { TenantParametrosFinanceiro } from "@/lib/api/tenant-config-client";
import { toast } from "@/lib/toast";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import {
  ParametrosBreadcrumb,
  ParametrosTabs,
} from "../components/parametros-tabs";

export default function ParametrosFinanceiroPage() {
  const staffUser = useStaffAuthStore((s) => s.user);
  const user: CadastrosUserContext = {
    id: staffUser?.id,
    role: staffUser?.role ?? "",
    permissions: staffUser?.permissions,
  };
  const canEdit = canDo(user, "parametros", "EDIT") || canDo(user, "financeiro", "EDIT");

  const { data, loading, update, reload } = useParametrosGerais();
  const [form, setForm] = useState<TenantParametrosFinanceiro | null>(null);
  const [tabelas, setTabelas] = useState<{ id: string; nome: string }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data?.financeiro) setForm(data.financeiro);
  }, [data]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await listCadastrosTabelasPrecos();
        setTabelas(res.items.map((t) => ({ id: t.id, nome: t.nome })));
      } catch {
        /* optional */
      }
    })();
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#regua-cobranca") {
      document.getElementById("regua-cobranca")?.scrollIntoView({ behavior: "smooth" });
    }
  }, [loading]);

  if (loading || !form || !data) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando parâmetros financeiros…
      </div>
    );
  }

  const handleSaveFinanceiro = async () => {
    setSaving(true);
    try {
      await update({ financeiro: form });
      toast.success("Parâmetros financeiros salvos.");
    } catch {
      toast.error("Erro ao salvar parâmetros financeiros.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <ParametrosBreadcrumb current="Financeiro" />
      <div>
        <h1 className="text-2xl font-bold">Parâmetros Gerais</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tolerâncias, encargos, emissão automática e régua de cobrança.
        </p>
      </div>
      <ParametrosTabs />

      <FormSection title="Parâmetros Financeiros" icon={DollarSign}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Dias tolerância bloqueio padrão">
            <Input
              type="number"
              min={0}
              max={365}
              disabled={!canEdit}
              value={form.diasToleranciaBloqueioPadrao}
              onChange={(e) =>
                setForm({ ...form, diasToleranciaBloqueioPadrao: Number(e.target.value) })
              }
            />
          </FormField>
          <FormField label="Dias vencimento boleto padrão">
            <Input
              type="number"
              min={1}
              max={90}
              disabled={!canEdit}
              value={form.diasVencimentoBoletoPadrao}
              onChange={(e) =>
                setForm({ ...form, diasVencimentoBoletoPadrao: Number(e.target.value) || 1 })
              }
            />
          </FormField>
          <FormField label="Multa por atraso (%)">
            <Input
              type="number"
              step={0.01}
              min={0}
              max={100}
              disabled={!canEdit}
              value={form.percentualMultaAtrasoPadrao}
              onChange={(e) =>
                setForm({ ...form, percentualMultaAtrasoPadrao: Number(e.target.value) })
              }
            />
          </FormField>
          <FormField label="Juros ao mês (%)">
            <Input
              type="number"
              step={0.01}
              min={0}
              max={100}
              disabled={!canEdit}
              value={form.percentualJurosAoMesPadrao}
              onChange={(e) =>
                setForm({ ...form, percentualJurosAoMesPadrao: Number(e.target.value) })
              }
            />
          </FormField>
        </div>

        <FormField label="Condição de pagamento padrão">
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            disabled={!canEdit}
            value={form.condicaoPagamentoDefault}
            onChange={(e) => setForm({ ...form, condicaoPagamentoDefault: e.target.value })}
          >
            {OPCOES_CONDICAO_PAGAMENTO.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Tabela de preço ativa">
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            disabled={!canEdit}
            value={form.tabelaPrecoAtivaId ?? ""}
            onChange={(e) =>
              setForm({ ...form, tabelaPrecoAtivaId: e.target.value || null })
            }
          >
            <option value="">— Nenhuma —</option>
            {tabelas.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </select>
        </FormField>

        <div className="mt-4 space-y-3">
          <FormField label="Emitir NFS-e automaticamente">
            <Switch
              checked={form.emiteNfseAutomatico}
              disabled={!canEdit}
              onCheckedChange={(v) => setForm({ ...form, emiteNfseAutomatico: v })}
            />
          </FormField>
          <FormField label="Emitir boleto automaticamente">
            <Switch
              checked={form.emiteBoletoAutomatico}
              disabled={!canEdit}
              onCheckedChange={(v) => setForm({ ...form, emiteBoletoAutomatico: v })}
            />
          </FormField>
        </div>

        {canEdit ? (
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setForm(data.financeiro)}>
              Cancelar
            </Button>
            <Button onClick={() => void handleSaveFinanceiro()} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando…
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Salvar parâmetros financeiros
                </>
              )}
            </Button>
          </div>
        ) : null}
      </FormSection>

      <ReguaCobrancaForm
        initial={data.reguaCobranca}
        disabled={!canEdit}
        onSaved={() => void reload()}
      />
    </div>
  );
}
