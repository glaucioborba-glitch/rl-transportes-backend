"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EquipeGestaoTabs } from "@/components/portal/equipe/equipe-gestao-tabs";
import { usePortalClienteAuthStore } from "@/stores/portalClienteAuthStore";
import { pode } from "@/stores/pessoaPermissoesStore";

export default function PerfilPessoasPage() {
  const clienteId = usePortalClienteAuthStore((s) => s.user?.clienteId ?? null);
  const podeGerenciar = pode("podeGerenciarPessoas");

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Gestão de equipe</CardTitle>
          <CardDescription>
            Delegue acessos operacionais a colaboradores internos (CPF) ou transportadoras
            terceirizadas (CNPJ). A responsabilidade financeira permanece com o cliente principal.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {clienteId ? (
            <EquipeGestaoTabs clienteId={clienteId} podeGerenciar={podeGerenciar} />
          ) : (
            <p className="text-sm text-slate-500">Sessão sem vínculo de cliente.</p>
          )}
          <Button type="button" variant="outline" asChild>
            <Link href="/portal/perfil">Voltar ao perfil</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
