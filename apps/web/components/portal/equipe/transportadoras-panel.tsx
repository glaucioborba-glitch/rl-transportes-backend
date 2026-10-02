"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ApiError,
  portalAlternarTransportadoraAtiva,
  portalCriarTransportadoraAutorizada,
  portalListarTransportadorasAutorizadas,
  type TransportadoraAutorizadaRow,
} from "@/lib/api/portal-client";
import { formatCpfCnpjBr } from "@/lib/format-cpf-cnpj-br";
import { validateCnpjDigits } from "@/lib/br-documents";
import { evaluatePassword } from "@/lib/security/password-validator";
import { toast } from "@/lib/toast";
import { TransportadoraPermissoesPanel } from "./transportadora-permissoes-panel";

type TransportadorasPanelProps = {
  clienteId: string;
  podeGerenciar: boolean;
};

export function TransportadorasPanel({ clienteId, podeGerenciar }: TransportadorasPanelProps) {
  const [lista, setLista] = useState<TransportadoraAutorizadaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cnpj, setCnpj] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [emailContato, setEmailContato] = useState("");
  const [password, setPassword] = useState("");

  const refresh = useCallback(async () => {
    if (!clienteId) return;
    setLoading(true);
    try {
      const rows = await portalListarTransportadorasAutorizadas(clienteId);
      setLista(rows);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível carregar transportadoras.");
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
      toast.error("Você não tem permissão para autorizar transportadoras.");
      return;
    }
    const cnpjLimpo = cnpj.replace(/\D/g, "");
    if (!validateCnpjDigits(cnpjLimpo)) {
      toast.error("Informe um CNPJ válido.");
      return;
    }
    if (!razaoSocial.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailContato.trim())) {
      toast.error("Preencha razão social e e-mail de contato válidos.");
      return;
    }
    if (!evaluatePassword(password).valid) {
      toast.error("A senha inicial não atende aos requisitos mínimos.");
      return;
    }
    setSaving(true);
    try {
      await portalCriarTransportadoraAutorizada({
        cnpj: cnpjLimpo,
        razaoSocial: razaoSocial.trim(),
        emailContato: emailContato.trim(),
        password,
      });
      toast.success("Transportadora autorizada. Compartilhe o CNPJ e a senha inicial.");
      setCnpj("");
      setRazaoSocial("");
      setEmailContato("");
      setPassword("");
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha ao autorizar transportadora.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleAtivo(row: TransportadoraAutorizadaRow) {
    if (!podeGerenciar) return;
    try {
      await portalAlternarTransportadoraAtiva(row.id, !row.ativo);
      toast.success(row.ativo ? "Transportadora desativada." : "Transportadora reativada.");
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível alterar o status.");
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-400">
        Delegue operações logísticas a transportadoras terceirizadas. Elas acessam o portal com o
        próprio CNPJ; o faturamento permanece com sua empresa.
      </p>

      <TransportadoraPermissoesPanel />

      {!podeGerenciar ? (
        <p className="text-sm text-amber-200/90">
          Apenas administradores da empresa podem autorizar transportadoras.
        </p>
      ) : (
        <form onSubmit={(e) => void onSubmit(e)} className="grid gap-3 rounded-lg border border-white/10 bg-zinc-950/40 p-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs text-slate-400">CNPJ da transportadora</label>
            <Input
              value={cnpj}
              onChange={(e) => setCnpj(formatCpfCnpjBr(e.target.value))}
              inputMode="numeric"
              placeholder="00.000.000/0000-00"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-400">Razão social</label>
            <Input value={razaoSocial} onChange={(e) => setRazaoSocial(e.target.value)} required />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs text-slate-400">E-mail de contato</label>
            <Input
              type="email"
              value={emailContato}
              onChange={(e) => setEmailContato(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs text-slate-400">Senha inicial (login com CNPJ)</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
              minLength={8}
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando…" : "Autorizar transportadora"}
            </Button>
          </div>
        </form>
      )}

      <div className="space-y-2 border-t border-white/10 pt-4">
        <h3 className="text-sm font-medium text-slate-300">Autorizadas</h3>
        {loading ? (
          <div className="flex items-center gap-2 text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando…
          </div>
        ) : lista.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma transportadora autorizada.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {lista.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-white/10 bg-zinc-950/50 px-3 py-2"
              >
                <div>
                  <p className="font-medium text-white">{t.razaoSocial}</p>
                  <p className="text-slate-400">
                    {formatCpfCnpjBr(t.cnpj)} · {t.emailContato}
                  </p>
                  {!t.ativo ? <p className="text-xs text-amber-400">Inativa</p> : null}
                </div>
                {podeGerenciar ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => void toggleAtivo(t)}>
                    {t.ativo ? "Desativar" : "Reativar"}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
