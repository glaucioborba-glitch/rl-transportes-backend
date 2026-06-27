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

const PERM_LABELS: Array<{ key: keyof PermissoesPessoa; label: string }> = [
  { key: "podeCriarSolicitacao", label: "Pode criar solicitações" },
  { key: "podeAnexarDocumentos", label: "Pode anexar documentos" },
  { key: "podeAgendarTurno", label: "Pode agendar turno" },
  { key: "podeVisualizarFinanceiro", label: "Pode visualizar financeiro" },
  { key: "podeAprovarOS", label: "Pode aprovar OS" },
  { key: "podeAlterarDadosGate", label: "Pode alterar dados no gate" },
  { key: "podeGerarPDF", label: "Pode gerar PDF" },
  { key: "podeGerenciarPessoas", label: "Pode gerenciar pessoas" },
];

type OperadoresInternosPanelProps = {
  clienteId: string;
  podeGerenciar: boolean;
};

export function OperadoresInternosPanel({ clienteId, podeGerenciar }: OperadoresInternosPanelProps) {
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

  function togglePerm(key: keyof PermissoesPessoa) {
    setPermissoes((p) => ({ ...p, [key]: !p[key] }));
  }

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
        <form onSubmit={(e) => void onSubmit(e)} className="grid gap-3 rounded-lg border border-white/10 bg-zinc-950/40 p-4 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs text-slate-400">Nome completo</label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-400">CPF</label>
            <Input
              value={cpf}
              onChange={(e) => setCpf(formatCpfBr(e.target.value))}
              inputMode="numeric"
              placeholder="000.000.000-00"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-400">E-mail</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs text-slate-400">Telefone (WhatsApp)</label>
            <Input
              value={telefone}
              onChange={(e) => setTelefone(formatPhoneBr(e.target.value))}
              inputMode="tel"
              required
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Permissões operacionais
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {PERM_LABELS.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={permissoes[key]}
                    onChange={() => togglePerm(key)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando…" : "Adicionar operador"}
            </Button>
          </div>
        </form>
      )}

      <div className="space-y-2 border-t border-white/10 pt-4">
        <h3 className="text-sm font-medium text-slate-300">Cadastrados</h3>
        {loading ? (
          <div className="flex items-center gap-2 text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando…
          </div>
        ) : lista.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum operador cadastrado.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {lista.map((p) => (
              <li
                key={p.id}
                className="rounded-md border border-white/10 bg-zinc-950/50 px-3 py-2"
              >
                <p className="font-medium text-white">{p.nome}</p>
                <p className="text-slate-400">
                  {p.cpf ? formatCpfBr(p.cpf) : "CPF pendente"} · {p.email}
                </p>
                {!p.ativo ? <p className="text-xs text-amber-400">Inativa</p> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
