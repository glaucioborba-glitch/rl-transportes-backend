"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ApiError,
  portalCriarPessoaAutorizada,
  portalListarPessoasAutorizadasCliente,
  type PessoaAutorizadaRow,
} from "@/lib/api/portal-client";
import { formatCpfBr } from "@/lib/format-cpf-cnpj-br";
import { formatPhoneBr } from "@/lib/nfse/cliente-fiscal";
import { toast } from "@/lib/toast";
import { validateCpfDigits } from "@/lib/validate-cpf";
import { DEFAULT_PERMISSOES, type PermissoesPessoa } from "@/stores/pessoaPermissoesStore";
import { usePessoaAutorizadaStore } from "@/stores/pessoaAutorizadaStore";
import { PermissoesOperacionaisFields } from "./permissoes-operacionais-fields";
import { EquipeAutorizacoesTable } from "./equipe-autorizacoes-table";

type OperadoresInternosPanelProps = {
  clienteId: string;
  podeGerenciar: boolean;
};

export function OperadoresInternosPanel({ clienteId, podeGerenciar }: OperadoresInternosPanelProps) {
  const pessoaSessaoId = usePessoaAutorizadaStore((s) => s.pessoa?.id ?? null);
  const [lista, setLista] = useState<PessoaAutorizadaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [telefone, setTelefone] = useState("");
  const [permissoes, setPermissoes] = useState<PermissoesPessoa>({ ...DEFAULT_PERMISSOES });

  const refresh = useCallback(async () => {
    if (!clienteId) return;
    setLoading(true);
    try {
      const rows = await portalListarPessoasAutorizadasCliente(clienteId);
      setLista(rows);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível carregar operadores.");
    } finally {
      setLoading(false);
    }
  }, [clienteId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!podeGerenciar) {
      toast.error("Você não tem permissão para gerenciar a equipe.");
      return;
    }
    const cpfLimpo = cpf.replace(/\D/g, "");
    if (!nome.trim() || !email.trim() || !validateCpfDigits(cpfLimpo)) {
      toast.error("Preencha nome, e-mail e CPF válidos.");
      return;
    }
    const tel = telefone.replace(/\D/g, "");
    if (!/^\d{10,11}$/.test(tel)) {
      toast.error("Telefone inválido (DDD + número).");
      return;
    }
    setSaving(true);
    try {
      await portalCriarPessoaAutorizada({
        nome: nome.trim(),
        email: email.trim(),
        cpf: cpfLimpo,
        telefone: tel,
        permissoes,
      });
      toast.success("Operador interno cadastrado.");
      setNome("");
      setEmail("");
      setCpf("");
      setTelefone("");
      setPermissoes({ ...DEFAULT_PERMISSOES });
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha ao cadastrar operador.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-400">
        Colaboradores com CPF que confirmam identidade após o login corporativo (CNPJ) do cliente
        principal.
      </p>

      {!podeGerenciar ? (
        <p className="text-sm text-amber-200/90">
          Apenas administradores da empresa podem cadastrar operadores internos.
        </p>
      ) : (
        <form
          onSubmit={(e) => void onSubmit(e)}
          className="grid gap-3 rounded-lg border border-white/10 bg-zinc-950/40 p-4 sm:grid-cols-2"
        >
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs text-muted-foreground">Nome completo</label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">CPF</label>
            <Input
              value={cpf}
              onChange={(e) => setCpf(formatCpfBr(e.target.value))}
              inputMode="numeric"
              placeholder="000.000.000-00"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">E-mail</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs text-muted-foreground">Telefone (WhatsApp)</label>
            <Input
              value={telefone}
              onChange={(e) => setTelefone(formatPhoneBr(e.target.value))}
              inputMode="tel"
              required
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Permissões operacionais
            </p>
            <PermissoesOperacionaisFields value={permissoes} onChange={setPermissoes} />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando…" : "Adicionar operador"}
            </Button>
          </div>
        </form>
      )}

      <div className="space-y-3 border-t border-white/10 pt-4">
        <h3 className="text-sm font-medium text-slate-300">Autorizações ativas</h3>
        {loading ? (
          <div className="flex items-center gap-2 text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando…
          </div>
        ) : (
          <EquipeAutorizacoesTable
            rows={lista}
            podeGerenciar={podeGerenciar}
            pessoaSessaoId={pessoaSessaoId}
            onChanged={() => void refresh()}
          />
        )}
      </div>
    </div>
  );
}
