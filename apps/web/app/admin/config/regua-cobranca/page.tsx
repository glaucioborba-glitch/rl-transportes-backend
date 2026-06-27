"use client";

import { useEffect, useState } from "react";
import { ContractCard } from "@/components/admin/contract-card";
import { Button } from "@/components/ui/button";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import {
  fetchReguaCobranca,
  patchReguaCobranca,
  type ReguaCobrancaConfig,
} from "@/lib/api/tenant-config-client";

const INPUT =
  "w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none";

export default function AdminReguaCobrancaPage() {
  const allowed = useStaffAuthStore((s) => s.user?.role === "ADMIN" || s.user?.role === "GERENTE");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState<ReguaCobrancaConfig | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const data = await fetchReguaCobranca();
        setForm(data?.reguaCobranca ?? null);
      } catch {
        setError("Não foi possível carregar a régua de cobrança.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (!allowed) return null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await patchReguaCobranca(form);
      setForm(updated.reguaCobranca);
      setSaved(true);
    } catch {
      setError("Falha ao salvar configurações.");
    } finally {
      setSaving(false);
    }
  }

  function toggleEtapa(key: keyof NonNullable<ReguaCobrancaConfig["etapas"]>) {
    setForm((prev) =>
      prev
        ? {
            ...prev,
            etapas: { ...prev.etapas, [key]: !prev.etapas?.[key] },
          }
        : prev,
    );
  }

  if (loading || !form) {
    return <p className="text-sm text-zinc-500">{loading ? "Carregando régua…" : "Configuração indisponível."}</p>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold text-white">Régua de Cobrança</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Parametrize avisos preventivos e de cobrança (WhatsApp e e-mail) antes do bloqueio sistêmico.
        </p>
      </div>

      <form onSubmit={(e) => void handleSave(e)} className="space-y-6">
        <ContractCard title="Geral">
          <label className="flex items-center gap-3 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={form.ativo ?? true}
              onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
              className="size-4 rounded border-zinc-600"
            />
            Régua automatizada ativa (CRON diário às 08:00)
          </label>
        </ContractCard>

        <ContractCard title="Gatilhos (dias)">
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block text-xs text-zinc-400">
              Dias antes do vencimento (pré-vencimento)
              <input
                type="number"
                min={1}
                max={30}
                className={INPUT}
                value={form.diasPreVencimento ?? 2}
                onChange={(e) =>
                  setForm({ ...form, diasPreVencimento: Number(e.target.value) || 2 })
                }
              />
            </label>
            <label className="block text-xs text-zinc-400">
              Dias de atraso (cobrança leve)
              <input
                type="number"
                min={1}
                max={90}
                className={INPUT}
                value={form.diasAtrasoLeve ?? 3}
                onChange={(e) =>
                  setForm({ ...form, diasAtrasoLeve: Number(e.target.value) || 3 })
                }
              />
            </label>
            <label className="block text-xs text-zinc-400">
              Dias antes do bloqueio (aviso final)
              <input
                type="number"
                min={1}
                max={30}
                className={INPUT}
                value={form.diasPreBloqueio ?? 1}
                onChange={(e) =>
                  setForm({ ...form, diasPreBloqueio: Number(e.target.value) || 1 })
                }
              />
            </label>
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            O bloqueio sistêmico usa a tolerância configurada em Financeiro / Cliente (Motor Financeiro V2).
          </p>
        </ContractCard>

        <ContractCard title="Etapas da régua">
          <div className="space-y-3">
            {(
              [
                ["preVencimento", "Pré-vencimento — lembrete amigável"],
                ["vencimentoHoje", "Vencimento hoje"],
                ["atrasoLeve", "Atraso leve — valor atualizado com encargos"],
                ["preBloqueio", "Pré-bloqueio — aviso final (24h antes da suspensão)"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-3 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={form.etapas?.[key] ?? true}
                  onChange={() => toggleEtapa(key)}
                  className="size-4 rounded border-zinc-600"
                />
                {label}
              </label>
            ))}
          </div>
        </ContractCard>

        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        {saved ? <p className="text-sm text-emerald-400">Configurações salvas.</p> : null}

        <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-500">
          {saving ? "Salvando…" : "Salvar régua"}
        </Button>
      </form>
    </div>
  );
}
