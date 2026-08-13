"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionTitle } from "@/components/portal/portal-primitives";
import { EquipeGestaoTabs } from "@/components/portal/equipe/equipe-gestao-tabs";
import { ApiError, fetchPortalDashboard } from "@/lib/api/portal-client";
import { labelCondicaoPagamento } from "@/lib/condicao-pagamento-portal";
import { formatCpfBr, formatCpfCnpjBr } from "@/lib/format-cpf-cnpj-br";
import { formatPhoneBr } from "@/lib/nfse/cliente-fiscal";
import { logoutPortalCliente } from "@/lib/portal-logout";
import { DEFAULT_PORTAL_HOME } from "@/lib/portal-redirect";
import { toast } from "@/lib/toast";
import { usePortalAuthStore } from "@/stores/portal-store";
import { usePortalClienteAuthStore } from "@/stores/portalClienteAuthStore";
import { usePessoaAutorizadaStore } from "@/stores/pessoaAutorizadaStore";
import { pode } from "@/stores/pessoaPermissoesStore";

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-slate-200">{value}</p>
    </div>
  );
}

function formatEndereco(endereco?: {
  logradouro?: string;
  numero?: string;
  complemento?: string | null;
  bairro?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
} | null): string {
  if (!endereco) return "—";
  const parts = [
    [endereco.logradouro, endereco.numero].filter(Boolean).join(", "),
    endereco.complemento,
    endereco.bairro,
    [endereco.cidade, endereco.uf].filter(Boolean).join(" / "),
    endereco.cep ? `CEP ${endereco.cep}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "—";
}

export default function PerfilPage() {
  const router = useRouter();
  const user = usePortalAuthStore((s) => s.user);
  const cliente = usePortalAuthStore((s) => s.cliente);
  const pessoa = usePessoaAutorizadaStore((s) => s.pessoa);
  const clienteId = usePortalClienteAuthStore((s) => s.user?.clienteId ?? null);
  const podeGerenciar = pode("podeGerenciarPessoas");

  const [empresa, setEmpresa] = useState<{
    nome: string;
    cpfCnpj: string;
    inscricaoEstadual: string;
    endereco: string;
    condicaoPagamento: string;
  } | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const refreshEmpresa = useCallback(async () => {
    try {
      const dash = await fetchPortalDashboard();
      const c = dash.cliente;
      if (!c) {
        setEmpresa(null);
        return;
      }
      setEmpresa({
        nome: c.nome?.trim() || "—",
        cpfCnpj: c.cpfCnpj?.trim() || "—",
        inscricaoEstadual:
          c.inscricaoEstadual?.trim() || "—",
        endereco: formatEndereco(c.endereco),
        condicaoPagamento: dash.condicaoPagamento
          ? labelCondicaoPagamento(dash.condicaoPagamento)
          : "—",
      });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível carregar dados da empresa.");
    }
  }, []);

  useEffect(() => {
    void refreshEmpresa();
  }, [refreshEmpresa]);

  const docDigits = user?.cpfCnpj?.replace(/\D/g, "") ?? "";
  const cpfOperador = docDigits.length === 11 ? formatCpfBr(docDigits) : "—";

  async function logout() {
    setLoggingOut(true);
    try {
      await logoutPortalCliente();
      toast.message("Sessão encerrada");
      router.replace("/portal/login");
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <SectionTitle
        title="Perfil"
        description="Dados da sessão, cadastro da empresa e gestão de equipe."
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
        <Card className="border-white/10 bg-black/20 md:col-span-4">
          <CardHeader>
            <CardTitle>Meus dados</CardTitle>
            <CardDescription>Identidade operacional da sessão atual.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-y-3">
              <ProfileField label="Nome" value={pessoa?.nome?.trim() || user?.nome?.trim() || "—"} />
              <ProfileField label="CPF" value={cpfOperador} />
              <ProfileField label="E-mail" value={pessoa?.email || user?.email || "—"} />
              <ProfileField
                label="Telefone"
                value={pessoa?.telefone ? formatPhoneBr(pessoa.telefone) : "—"}
              />
            </div>
            <Button type="button" variant="outline" className="w-full" asChild>
              <Link href="/portal/recuperar">Alterar senha</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-black/20 md:col-span-8">
          <CardHeader>
            <CardTitle>Dados da empresa</CardTitle>
            <CardDescription>Cadastro corporativo vinculado ao portal.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-y-3 sm:grid-cols-2">
              <ProfileField label="Razão social" value={empresa?.nome ?? cliente?.razaoSocial ?? "—"} />
              <ProfileField
                label="CNPJ"
                value={empresa?.cpfCnpj ?? (cliente?.cpfCnpj ? formatCpfCnpjBr(cliente.cpfCnpj) : "—")}
              />
              <ProfileField label="Inscrição estadual" value={empresa?.inscricaoEstadual ?? "—"} />
              <ProfileField label="Condição de pagamento" value={empresa?.condicaoPagamento ?? "—"} />
              <div className="sm:col-span-2">
                <ProfileField label="Endereço" value={empresa?.endereco ?? "—"} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card id="equipe" className="border-white/10 bg-black/20 md:col-span-12">
          <CardHeader>
            <CardTitle>Gestão de equipe / Autorizações</CardTitle>
            <CardDescription>
              Delegue acessos a colaboradores (CPF) ou transportadoras terceirizadas (CNPJ). Edite
              permissões ou revogue acessos quando necessário.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {clienteId ? (
              <EquipeGestaoTabs clienteId={clienteId} podeGerenciar={podeGerenciar} />
            ) : (
              <p className="text-sm text-muted-foreground">Sessão sem vínculo de cliente.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => router.push("/portal/perfil/seguranca")}>
          Segurança
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/portal/perfil/dispositivos")}>
          Dispositivos e sessões
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push(DEFAULT_PORTAL_HOME)}>
          Voltar às solicitações
        </Button>
        <Button
          variant="ghost"
          className="text-red-300 hover:bg-red-500/10"
          disabled={loggingOut}
          onClick={() => void logout()}
        >
          Sair
        </Button>
      </div>
    </main>
  );
}
