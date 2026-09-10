"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CnpjPuxarField, empresaFromReceita } from "@/components/super-admin/cnpj-puxar-field";
import {
  SAAS_PLANOS,
  type SaasEmpresaIdentidade,
  type SaasTenantRow,
} from "@/lib/api/super-admin-client";

const SELECT =
  "flex h-10 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white";

const STATUS_OPTS: Array<{ value: SaasTenantRow["status"]; label: string }> = [
  { value: "ATIVO", label: "Ativo" },
  { value: "SUSPENSO", label: "Suspenso (manutenção)" },
  { value: "BLOQUEADO", label: "Bloqueado (inadimplência)" },
];

type Props = {
  tenant: SaasTenantRow | null;
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: (payload: {
    nome: string;
    plano: string;
    status: SaasTenantRow["status"];
    cnpj: string;
    empresa?: SaasEmpresaIdentidade;
  }) => void;
};

export function TenantEditDialog({ tenant, open, saving, onClose, onSave }: Props) {
  const [nome, setNome] = useState("");
  const [plano, setPlano] = useState("STANDARD");
  const [status, setStatus] = useState<SaasTenantRow["status"]>("ATIVO");
  const [cnpj, setCnpj] = useState("");
  const [empresa, setEmpresa] = useState<SaasEmpresaIdentidade | undefined>();

  useEffect(() => {
    if (!tenant) return;
    setNome(tenant.nome);
    setPlano(tenant.plano || "STANDARD");
    setStatus(tenant.status);
    setCnpj(tenant.cnpj ?? "");
    setEmpresa(undefined);
  }, [tenant]);

  if (!tenant) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar terminal</DialogTitle>
          <DialogDescription>
            O slug <span className="font-mono text-violet-300">{tenant.id}</span> não muda — é o ID
            do tenant. O CNPJ alimenta <strong>Cadastros → Empresa</strong>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="block text-xs uppercase tracking-wide text-zinc-500">CNPJ</label>
          <CnpjPuxarField
            cnpj={cnpj}
            onCnpj={(d) => {
              setCnpj(d);
              setEmpresa(undefined);
            }}
            onPuxou={(r) => {
              const patch = empresaFromReceita(r);
              setEmpresa(patch);
              setNome(r.razaoSocial.trim() || r.nomeFantasia.trim() || tenant.nome);
            }}
            disabled={saving}
          />
          <label className="block text-xs uppercase tracking-wide text-zinc-500">Nome</label>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} className="bg-black/40" />
          <label className="block text-xs uppercase tracking-wide text-zinc-500">Plano</label>
          <select className={SELECT} value={plano} onChange={(e) => setPlano(e.target.value)}>
            {SAAS_PLANOS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
            {!SAAS_PLANOS.includes(plano as (typeof SAAS_PLANOS)[number]) ? (
              <option value={plano}>{plano}</option>
            ) : null}
          </select>
          <label className="block text-xs uppercase tracking-wide text-zinc-500">Status</label>
          <select
            className={SELECT}
            value={status}
            disabled={tenant.ehBase}
            onChange={(e) => setStatus(e.target.value as SaasTenantRow["status"])}
          >
            {STATUS_OPTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          {tenant.ehBase ? (
            <p className="text-xs text-zinc-500">O terminal base permanece sempre ativo.</p>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={saving || !nome.trim()}
            onClick={() =>
              onSave({ nome: nome.trim(), plano, status, cnpj, empresa })
            }
          >
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
