"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  buscarDadosCnpj,
  CNPJ_LOOKUP_FAIL_TOAST,
  type CnpjDadosEmpresa,
} from "@/lib/brasilapi/cnpj";
import { formatCNPJ, isValidCNPJ } from "@/lib/cadastros/formatters";
import type { SaasEmpresaIdentidade } from "@/lib/api/super-admin-client";
import { toast } from "@/lib/toast";

type Props = {
  cnpj: string;
  onCnpj: (digits: string) => void;
  onPuxou: (r: CnpjDadosEmpresa) => void;
  disabled?: boolean;
};

export function CnpjPuxarField({ cnpj, onCnpj, onPuxou, disabled }: Props) {
  const [busy, setBusy] = useState(false);

  async function puxar() {
    const clean = cnpj.replace(/\D/g, "");
    if (clean.length !== 14) {
      toast.error("Informe um CNPJ com 14 dígitos.");
      return;
    }
    if (!isValidCNPJ(clean)) {
      toast.error("CNPJ inválido.");
      return;
    }
    setBusy(true);
    try {
      const r = await buscarDadosCnpj(clean);
      if (!r.razaoSocial.trim()) {
        toast.error("A Receita não devolveu a razão social. Preencha o nome à mão.");
        return;
      }
      onPuxou(r);
      toast.success(`Razão social: ${r.razaoSocial}`);
    } catch {
      toast.warning(CNPJ_LOOKUP_FAIL_TOAST);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex gap-2">
      <Input
        placeholder="00.000.000/0000-00"
        value={formatCNPJ(cnpj) || cnpj}
        disabled={disabled || busy}
        onChange={(e) => onCnpj(e.target.value.replace(/\D/g, "").slice(0, 14))}
        className="bg-black/40"
      />
      <Button type="button" variant="outline" disabled={disabled || busy} onClick={() => void puxar()}>
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Puxar
      </Button>
    </div>
  );
}

export function empresaFromReceita(r: CnpjDadosEmpresa): SaasEmpresaIdentidade {
  return {
    razaoSocial: r.razaoSocial || undefined,
    nomeFantasia: r.nomeFantasia || undefined,
    cep: r.cep || undefined,
    logradouro: r.logradouro || undefined,
    numero: r.numero || undefined,
    bairro: r.bairro || undefined,
    cidade: r.municipio || undefined,
    uf: r.uf || undefined,
    email: r.emailReceita || undefined,
  };
}
