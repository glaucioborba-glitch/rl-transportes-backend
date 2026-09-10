"use client";

import { useEffect, useState } from "react";
import { Building2, Landmark, Loader2, Save } from "lucide-react";
import { FormField, FormSection, CADASTRO_PAGE_CLASS } from "@/components/cadastros/form-field";
import { LogoUploadCard } from "@/components/cadastros/logo-upload-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/staff-client";
import {
  deleteEmpresaLogo,
  fetchEmpresaOperadora,
  patchEmpresaOperadora,
  uploadEmpresaLogo,
  type EmpresaLogoSlot,
  type EmpresaOperadora,
} from "@/lib/api/empresa-client";
import { buscarCadastrosCep, validateCadastrosCnpj } from "@/lib/api/cadastros-clientes-client";
import { formatCEP, formatCNPJ, formatPhone, isValidCNPJ } from "@/lib/cadastros/formatters";
import { canDo, type CadastrosUserContext } from "@/lib/cadastros/permission-matrix";
import { toast } from "@/lib/toast";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import { invalidateEmpresaBranding } from "@/hooks/use-empresa-branding";
import Link from "next/link";

const SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

export default function CadastroEmpresaPage() {
  const staffUser = useStaffAuthStore((s) => s.user);
  const user: CadastrosUserContext = {
    id: staffUser?.id,
    role: staffUser?.role ?? "",
    permissions: staffUser?.permissions,
  };
  const canEdit = canDo(user, "parametros", "EDIT");

  const [data, setData] = useState<EmpresaOperadora | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyCnpj, setBusyCnpj] = useState(false);
  const [busyCep, setBusyCep] = useState(false);

  useEffect(() => {
    void fetchEmpresaOperadora()
      .then(setData)
      .catch((err) => {
        toast.error(err instanceof ApiError ? err.message : "Não foi possível carregar a empresa.");
      })
      .finally(() => setLoading(false));
  }, []);

  async function salvar() {
    if (!data) return;
    setSaving(true);
    try {
      const out = await patchEmpresaOperadora({
        razaoSocial: data.razaoSocial,
        nomeFantasia: data.nomeFantasia,
        cnpj: data.cnpj,
        inscricaoEstadual: data.inscricaoEstadual,
        inscricaoMunicipal: data.inscricaoMunicipal,
        cnae: data.cnae,
        telefone: data.telefone,
        email: data.email,
        emailNf: data.emailNf,
        emailFinanceiro: data.emailFinanceiro,
        site: data.site,
        cep: data.cep,
        logradouro: data.logradouro,
        numero: data.numero,
        complemento: data.complemento,
        bairro: data.bairro,
        cidade: data.cidade,
        uf: data.uf,
        regimeTributario: data.regimeTributario,
        simplesAnexo: data.simplesAnexo,
        aliquotaIss: data.aliquotaIss,
        aliquotaPis: data.aliquotaPis,
        aliquotaCofins: data.aliquotaCofins,
        aliquotaCsll: data.aliquotaCsll,
        aliquotaIrpj: data.aliquotaIrpj,
      });
      setData(out);
      invalidateEmpresaBranding();
      toast.success("Cadastro da empresa salvo.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function buscaCnpj(cnpj: string) {
    const clean = cnpj.replace(/\D/g, "");
    if (clean.length !== 14 || !data) return;
    if (!isValidCNPJ(clean)) {
      toast.error("CNPJ inválido.");
      return;
    }
    setBusyCnpj(true);
    try {
      const r = await validateCadastrosCnpj(clean);
      setData((prev) =>
        prev
          ? {
              ...prev,
              razaoSocial: r.razaoSocial || prev.razaoSocial,
              nomeFantasia: r.nomeFantasia || prev.nomeFantasia,
              cep: r.cep || prev.cep,
              logradouro: r.endereco || prev.logradouro,
              numero: r.numero || prev.numero,
              bairro: r.bairro || prev.bairro,
              cidade: r.cidade || prev.cidade,
              uf: r.uf || prev.uf,
              email: r.email || prev.email,
              telefone: r.telefone || prev.telefone,
            }
          : prev,
      );
      if (r.razaoSocial) toast.success("Dados preenchidos pela Receita.");
    } catch {
      toast.error("Não foi possível consultar o CNPJ.");
    } finally {
      setBusyCnpj(false);
    }
  }

  async function buscaCep(cep: string) {
    const clean = cep.replace(/\D/g, "");
    if (clean.length !== 8 || !data) return;
    setBusyCep(true);
    try {
      const r = await buscarCadastrosCep(clean);
      setData((prev) =>
        prev
          ? {
              ...prev,
              logradouro: r.logradouro || prev.logradouro,
              bairro: r.bairro || prev.bairro,
              cidade: r.localidade || prev.cidade,
              uf: r.uf || prev.uf,
              complemento: r.complemento || prev.complemento,
            }
          : prev,
      );
    } catch {
      toast.error("CEP não encontrado.");
    } finally {
      setBusyCep(false);
    }
  }

  if (loading || !data) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando cadastro da empresa…
      </div>
    );
  }

  const set = <K extends keyof EmpresaOperadora>(key: K, value: EmpresaOperadora[K]) =>
    setData((prev) => (prev ? { ...prev, [key]: value } : prev));

  return (
    <div className={CADASTRO_PAGE_CLASS}>
      <div>
        <h1 className="text-2xl font-bold">Empresa operadora</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ficha da RL Transportes — quem opera este sistema. Esses dados alimentam RIC, e-mails,
          portais e, mais adiante, a previsão de impostos e contas a pagar.
        </p>
      </div>

      <FormSection title="Identidade" icon={Building2}>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <FormField label="CNPJ" required size="md">
              <div className="flex items-center gap-2">
                <Input
                  disabled={!canEdit}
                  value={formatCNPJ(data.cnpj)}
                  onChange={(e) => set("cnpj", e.target.value.replace(/\D/g, ""))}
                  onBlur={(e) => void buscaCnpj(e.target.value)}
                  placeholder="00.000.000/0000-00"
                  className="tabular-nums"
                />
                {busyCnpj ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : null}
              </div>
            </FormField>
            <FormField label="Razão social" required className="min-w-[16rem] flex-1">
              <Input
                disabled={!canEdit}
                value={data.razaoSocial}
                onChange={(e) => set("razaoSocial", e.target.value)}
              />
            </FormField>
            <FormField label="Nome fantasia" className="min-w-[14rem] flex-1">
              <Input
                disabled={!canEdit}
                value={data.nomeFantasia}
                onChange={(e) => set("nomeFantasia", e.target.value)}
              />
            </FormField>
          </div>
          <div className="flex flex-wrap gap-4">
            <FormField label="CNAE" size="sm">
              <Input
                disabled={!canEdit}
                value={data.cnae}
                onChange={(e) => set("cnae", e.target.value.replace(/\D/g, "").slice(0, 7))}
                className="tabular-nums"
              />
            </FormField>
            <FormField label="Inscrição estadual" size="md">
              <Input
                disabled={!canEdit}
                value={data.inscricaoEstadual}
                onChange={(e) => set("inscricaoEstadual", e.target.value)}
              />
            </FormField>
            <FormField label="Inscrição municipal" size="md">
              <Input
                disabled={!canEdit}
                value={data.inscricaoMunicipal}
                onChange={(e) => set("inscricaoMunicipal", e.target.value)}
              />
            </FormField>
          </div>
        </div>
      </FormSection>

      <FormSection title="Endereço e contato" icon={Building2}>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <FormField label="CEP" size="sm">
              <div className="flex items-center gap-2">
                <Input
                  disabled={!canEdit}
                  value={formatCEP(data.cep)}
                  onChange={(e) => set("cep", e.target.value.replace(/\D/g, ""))}
                  onBlur={(e) => void buscaCep(e.target.value)}
                  className="tabular-nums"
                />
                {busyCep ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : null}
              </div>
            </FormField>
            <FormField label="Logradouro" className="min-w-[16rem] flex-[3]">
              <Input
                disabled={!canEdit}
                value={data.logradouro}
                onChange={(e) => set("logradouro", e.target.value)}
              />
            </FormField>
            <FormField label="Número" size="sm">
              <Input disabled={!canEdit} value={data.numero} onChange={(e) => set("numero", e.target.value)} />
            </FormField>
          </div>
          <div className="flex flex-wrap gap-4">
            <FormField label="Complemento" className="min-w-[10rem] flex-1">
              <Input
                disabled={!canEdit}
                value={data.complemento}
                onChange={(e) => set("complemento", e.target.value)}
              />
            </FormField>
            <FormField label="Bairro" className="min-w-[10rem] flex-1">
              <Input disabled={!canEdit} value={data.bairro} onChange={(e) => set("bairro", e.target.value)} />
            </FormField>
            <FormField label="Cidade" className="min-w-[10rem] flex-1">
              <Input disabled={!canEdit} value={data.cidade} onChange={(e) => set("cidade", e.target.value)} />
            </FormField>
            <FormField label="UF" size="xs">
              <Input
                disabled={!canEdit}
                maxLength={2}
                value={data.uf}
                onChange={(e) => set("uf", e.target.value.toUpperCase())}
              />
            </FormField>
          </div>
          <div className="flex flex-wrap gap-4">
            <FormField label="Telefone" size="md">
              <Input
                disabled={!canEdit}
                value={formatPhone(data.telefone)}
                onChange={(e) => set("telefone", e.target.value)}
                className="tabular-nums"
              />
            </FormField>
            <FormField label="E-mail geral" className="min-w-[14rem] flex-1">
              <Input disabled={!canEdit} value={data.email} onChange={(e) => set("email", e.target.value)} />
            </FormField>
            <FormField label="E-mail NF-e / NFS-e" className="min-w-[14rem] flex-1">
              <Input disabled={!canEdit} value={data.emailNf} onChange={(e) => set("emailNf", e.target.value)} />
            </FormField>
            <FormField label="E-mail financeiro" className="min-w-[14rem] flex-1">
              <Input
                disabled={!canEdit}
                value={data.emailFinanceiro}
                onChange={(e) => set("emailFinanceiro", e.target.value)}
              />
            </FormField>
            <FormField label="Site" className="min-w-[14rem] flex-1">
              <Input disabled={!canEdit} value={data.site} onChange={(e) => set("site", e.target.value)} />
            </FormField>
          </div>
        </div>
      </FormSection>

      <FormSection title="Regime e provisão de tributos" icon={Landmark}>
        <p className="mb-3 text-xs text-muted-foreground">
          Percentuais que o financeiro usa na provisão de encargos. A simulação roda em{" "}
          <Link href="/financeiro/provisao-encargos" className="text-primary underline">
            Financeiro → Provisão de encargos
          </Link>
          . O fechamento automático roda às 00:01 do dia 1 (mês anterior).
        </p>
        <div className="flex flex-wrap gap-4">
          <FormField label="Regime" className="min-w-[14rem] flex-1">
            <select
              className={SELECT_CLASS}
              disabled={!canEdit}
              value={data.regimeTributario}
              onChange={(e) =>
                set("regimeTributario", e.target.value as EmpresaOperadora["regimeTributario"])
              }
            >
              <option value="SIMPLES_NACIONAL">Simples Nacional</option>
              <option value="LUCRO_PRESUMIDO">Lucro presumido</option>
              <option value="LUCRO_REAL">Lucro real</option>
            </select>
          </FormField>
          <FormField label="Anexo / faixa (Simples)" className="min-w-[12rem] flex-1">
            <Input
              disabled={!canEdit}
              value={data.simplesAnexo}
              onChange={(e) => set("simplesAnexo", e.target.value)}
              placeholder="Ex.: Anexo III"
            />
          </FormField>
          {(
            [
              ["aliquotaIss", "ISS %"],
              ["aliquotaPis", "PIS %"],
              ["aliquotaCofins", "COFINS %"],
              ["aliquotaCsll", "CSLL %"],
              ["aliquotaIrpj", "IRPJ %"],
            ] as const
          ).map(([key, label]) => (
            <FormField key={key} label={label} size="sm">
              <Input
                type="number"
                min={0}
                max={100}
                step={0.01}
                disabled={!canEdit}
                value={data[key]}
                onChange={(e) => set(key, Number(e.target.value))}
              />
            </FormField>
          ))}
        </div>
      </FormSection>

      <div>
        <h2 className="text-lg font-semibold">Marcas visuais</h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          Cada arquivo entra num lugar específico. Se um slot estiver vazio, o sistema usa o
          horizontal e, por último, o ícone.
        </p>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {data.slots.map((spec) => (
            <LogoUploadCard
              key={spec.slot}
              spec={spec}
              previewUrl={data.logos[spec.slot]?.url}
              disabled={!canEdit}
              accept={
                spec.slot === "documento" || spec.slot === "email"
                  ? "image/png,image/jpeg"
                  : "image/png,image/jpeg,image/webp,image/svg+xml"
              }
              onUpload={async (file) => {
                try {
                  const out = await uploadEmpresaLogo(spec.slot as EmpresaLogoSlot, file);
                  setData(out);
                  invalidateEmpresaBranding();
                  toast.success(`${spec.titulo} atualizada.`);
                } catch (err) {
                  toast.error(err instanceof ApiError ? err.message : "Falha no upload.");
                  throw err;
                }
              }}
              onRemove={async () => {
                try {
                  const out = await deleteEmpresaLogo(spec.slot as EmpresaLogoSlot);
                  setData(out);
                  invalidateEmpresaBranding();
                  toast.success(`${spec.titulo} removida.`);
                } catch (err) {
                  toast.error(err instanceof ApiError ? err.message : "Não foi possível remover.");
                }
              }}
            />
          ))}
        </div>
      </div>

      <Button disabled={!canEdit || saving} onClick={() => void salvar()}>
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        Salvar cadastro
      </Button>
    </div>
  );
}
