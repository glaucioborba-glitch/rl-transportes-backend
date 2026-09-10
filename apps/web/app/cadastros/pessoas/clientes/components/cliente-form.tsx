"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, FileText, ImagePlus, Loader2, MapPin, Phone, Save, X } from "lucide-react";
import { LogoUploadCard } from "@/components/cadastros/logo-upload-card";
import {
  deleteClienteLogo,
  fetchClienteLogo,
  fetchEmpresaOperadora,
  uploadClienteLogo,
  type ClienteLogoMeta,
  type EmpresaOperadora,
} from "@/lib/api/empresa-client";
import { FormField, FormSection, CADASTRO_FORM_CLASS } from "@/components/cadastros/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/staff-client";
import {
  buscarCadastrosCep,
  createCadastrosCliente,
  EMPTY_CLIENTE_FORM,
  getCadastrosCliente,
  mapCadastrosClienteForm,
  updateCadastrosCliente,
  validateCadastrosCnpj,
  type CadastrosClienteFormData,
} from "@/lib/api/cadastros-clientes-client";
import {
  CLIENTE_PAPEL_LABEL,
  CLIENTE_PAPEIS_OPCOES,
  clientePapelSelecionado,
  normalizeClientePapeis,
} from "@/lib/cadastros/cliente-papeis";
import { formatCEP, formatCNPJ, formatPhone, isValidCNPJ } from "@/lib/cadastros/formatters";
import { toast } from "@/lib/toast";

const SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type Props = {
  clienteId?: string;
};

export function ClienteForm({ clienteId }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(clienteId));
  const [validatingCnpj, setValidatingCnpj] = useState(false);
  const [validatingCep, setValidatingCep] = useState(false);
  const [formData, setFormData] = useState<CadastrosClienteFormData>(EMPTY_CLIENTE_FORM);
  const [clienteLogo, setClienteLogo] = useState<ClienteLogoMeta | null>(null);
  const [clienteLogoSpec, setClienteLogoSpec] = useState<EmpresaOperadora["clienteLogoSpec"] | null>(
    null,
  );

  useEffect(() => {
    if (!clienteId) return;
    let on = true;
    setLoading(true);
    void (async () => {
      try {
        const data = await getCadastrosCliente(clienteId);
        if (!on) return;
        const mapped = mapCadastrosClienteForm(data);
        if (!mapped.razaoSocial && !mapped.cnpj) {
          throw new Error("A API devolveu o cadastro sem razão social/CNPJ.");
        }
        setFormData(mapped);
        const [logo, empresa] = await Promise.all([
          fetchClienteLogo(clienteId).catch(() => null),
          fetchEmpresaOperadora().catch(() => null),
        ]);
        if (!on) return;
        setClienteLogo(logo);
        if (empresa?.clienteLogoSpec) setClienteLogoSpec(empresa.clienteLogoSpec);
      } catch (err) {
        if (on) {
          toast.error(err instanceof ApiError ? err.message : "Erro ao carregar cliente.");
        }
      } finally {
        if (on) setLoading(false);
      }
    })();
    return () => {
      on = false;
    };
  }, [clienteId]);

  const togglePapel = (papel: (typeof CLIENTE_PAPEIS_OPCOES)[number], checked: boolean) => {
    setFormData((prev) => {
      const next = checked
        ? normalizeClientePapeis([...prev.papeis, papel])
        : normalizeClientePapeis(prev.papeis.filter((p) => p !== papel));
      return { ...prev, papeis: next };
    });
  };

  const validateCnpj = async (cnpj: string) => {
    const clean = cnpj.replace(/\D/g, "");
    if (clean.length !== 14) return;

    setValidatingCnpj(true);
    try {
      if (!isValidCNPJ(clean)) {
        toast.error("CNPJ inválido — dígitos verificadores não conferem.");
        return;
      }

      const data = await validateCadastrosCnpj(clean);
      if (data.razaoSocial) {
        setFormData((prev) => ({
          ...prev,
          razaoSocial: data.razaoSocial || prev.razaoSocial,
          nomeFantasia: data.nomeFantasia || prev.nomeFantasia,
          cep: data.cep || prev.cep,
          endereco: data.endereco || prev.endereco,
          numero: data.numero || prev.numero,
          bairro: data.bairro || prev.bairro,
          cidade: data.cidade || prev.cidade,
          uf: data.uf || prev.uf,
          email: data.email || prev.email,
          telefone: data.telefone || prev.telefone,
        }));
        toast.success("CNPJ validado e dados preenchidos automaticamente.");
      } else {
        toast.info("CNPJ válido, mas não foi possível buscar dados automáticos.");
      }
    } catch {
      toast.info("CNPJ válido, mas não foi possível buscar dados automáticos.");
    } finally {
      setValidatingCnpj(false);
    }
  };

  const buscaCep = async (cep: string) => {
    const clean = cep.replace(/\D/g, "");
    if (clean.length !== 8) return;

    setValidatingCep(true);
    try {
      const data = await buscarCadastrosCep(clean);
      if (data.logradouro) {
        setFormData((prev) => ({
          ...prev,
          endereco: data.logradouro,
          bairro: data.bairro,
          cidade: data.localidade,
          uf: data.uf,
          complemento: data.complemento || prev.complemento,
        }));
      }
    } catch {
      toast.info("CEP não encontrado. Preencha manualmente.");
    } finally {
      setValidatingCep(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.razaoSocial || !formData.cnpj) {
      toast.error("Razão Social e CNPJ são obrigatórios.");
      return;
    }
    const papeis = normalizeClientePapeis(formData.papeis);
    if (!papeis.length) {
      toast.error("Selecione Cliente e/ou Transportador.");
      return;
    }

    setSaving(true);
    try {
      const payload = { ...formData, papeis };
      if (clienteId) {
        await updateCadastrosCliente(clienteId, payload);
        toast.success("Cadastro atualizado com sucesso!");
      } else {
        await createCadastrosCliente(payload);
        toast.success("Cadastro criado com sucesso!");
      }
      router.push("/cadastros/pessoas/clientes");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao salvar cadastro.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Carregando cliente…
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={CADASTRO_FORM_CLASS}>
      <FormSection title="Dados Cadastrais" icon={Building2}>
        <div className="space-y-4">
          <FormField label="Tipo de cadastro" required>
            <div className="flex min-h-10 flex-wrap items-center gap-4">
              {CLIENTE_PAPEIS_OPCOES.map((papel) => (
                <label key={papel} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={clientePapelSelecionado(formData.papeis, papel)}
                    onChange={(e) => togglePapel(papel, e.target.checked)}
                    className="h-4 w-4 rounded border-border"
                  />
                  {CLIENTE_PAPEL_LABEL[papel]}
                </label>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              A mesma empresa pode ser cliente e transportador. Com Transportador marcado, ela
              aparece na aba Transportadoras — não é preciso cadastrar de novo.
            </p>
          </FormField>

          <div className="flex flex-wrap gap-4">
            <FormField label="Razão Social" required className="min-w-[16rem] flex-1">
              <Input
                value={formData.razaoSocial}
                onChange={(e) => setFormData({ ...formData, razaoSocial: e.target.value })}
                placeholder="Ex: RL Transportes, Carga e Descarga LTDA"
              />
            </FormField>
            <FormField label="Nome Fantasia" className="min-w-[14rem] flex-1">
              <Input
                value={formData.nomeFantasia}
                onChange={(e) => setFormData({ ...formData, nomeFantasia: e.target.value })}
                placeholder="Ex: RL Transportes"
              />
            </FormField>
          </div>

          <div className="flex flex-wrap gap-4">
            <FormField label="CNPJ" required size="md">
              <div className="flex items-center gap-2">
                <Input
                  value={formatCNPJ(formData.cnpj)}
                  onChange={(e) =>
                    setFormData({ ...formData, cnpj: e.target.value.replace(/\D/g, "") })
                  }
                  onBlur={(e) => void validateCnpj(e.target.value)}
                  placeholder="00.000.000/0000-00"
                  className="tabular-nums"
                  disabled={Boolean(clienteId)}
                />
                {validatingCnpj ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                ) : null}
              </div>
            </FormField>
            <FormField label="Inscrição Estadual (IE)" size="md">
              <Input
                value={formData.ie}
                onChange={(e) => setFormData({ ...formData, ie: e.target.value })}
                placeholder="000.000.000.000"
                className="tabular-nums"
              />
            </FormField>
            <FormField label="Inscrição Municipal (IM)" size="md">
              <Input
                value={formData.im}
                onChange={(e) => setFormData({ ...formData, im: e.target.value })}
                placeholder="0000000"
                className="tabular-nums"
              />
            </FormField>
          </div>
        </div>
      </FormSection>

      <FormSection title="Endereço" icon={MapPin}>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <FormField label="CEP" size="sm">
              <div className="flex items-center gap-2">
                <Input
                  value={formatCEP(formData.cep)}
                  onChange={(e) => setFormData({ ...formData, cep: e.target.value.replace(/\D/g, "") })}
                  onBlur={(e) => void buscaCep(e.target.value)}
                  placeholder="00000-000"
                  className="tabular-nums"
                />
                {validatingCep ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                ) : null}
              </div>
            </FormField>
            <FormField label="Endereço" className="min-w-[16rem] flex-[3]">
              <Input
                value={formData.endereco}
                onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                placeholder="Rua, Avenida..."
              />
            </FormField>
            <FormField label="Número" size="sm">
              <Input
                value={formData.numero}
                onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                placeholder="123"
              />
            </FormField>
          </div>

          <div className="flex flex-wrap gap-4">
            <FormField label="Complemento" className="min-w-[10rem] flex-1">
              <Input
                value={formData.complemento}
                onChange={(e) => setFormData({ ...formData, complemento: e.target.value })}
                placeholder="Sala, Andar..."
              />
            </FormField>
            <FormField label="Bairro" className="min-w-[10rem] flex-1">
              <Input
                value={formData.bairro}
                onChange={(e) => setFormData({ ...formData, bairro: e.target.value })}
                placeholder="Centro"
              />
            </FormField>
            <FormField label="Cidade" className="min-w-[10rem] flex-1">
              <Input
                value={formData.cidade}
                onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                placeholder="São Paulo"
              />
            </FormField>
            <FormField label="UF" size="xs">
              <Input
                value={formData.uf}
                onChange={(e) =>
                  setFormData({ ...formData, uf: e.target.value.toUpperCase().slice(0, 2) })
                }
                placeholder="SP"
                maxLength={2}
              />
            </FormField>
          </div>
        </div>
      </FormSection>

      <FormSection title="Contato" icon={Phone}>
        <div className="flex flex-wrap gap-4">
          <FormField label="E-mail" required className="min-w-[16rem] flex-[2]">
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="contato@empresa.com.br"
            />
          </FormField>
          <FormField label="Telefone" size="md">
            <Input
              value={formatPhone(formData.telefone)}
              onChange={(e) =>
                setFormData({ ...formData, telefone: e.target.value.replace(/\D/g, "") })
              }
              placeholder="(00) 0000-0000"
              className="tabular-nums"
            />
          </FormField>
          <FormField label="Celular" size="md">
            <Input
              value={formatPhone(formData.celular)}
              onChange={(e) =>
                setFormData({ ...formData, celular: e.target.value.replace(/\D/g, "") })
              }
              placeholder="(00) 00000-0000"
              className="tabular-nums"
            />
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Dados Financeiros" icon={FileText}>
        <div className="flex flex-wrap gap-4">
          <FormField label="Condição de Pagamento" className="min-w-[14rem] flex-1">
            <select
              value={formData.condicaoPagamento}
              onChange={(e) => setFormData({ ...formData, condicaoPagamento: e.target.value })}
              className={SELECT_CLASS}
            >
              <option value="">Selecione...</option>
              <option value="A_VISTA">À vista</option>
              <option value="30_DIAS">30 dias</option>
              <option value="30_60">30/60 dias</option>
              <option value="30_60_90">30/60/90 dias</option>
              <option value="PERSONALIZADO">Personalizado</option>
            </select>
          </FormField>
          <FormField label="Limite de Crédito (R$)" className="min-w-[12rem] flex-1">
            <Input
              type="number"
              value={formData.limiteCredito}
              onChange={(e) => setFormData({ ...formData, limiteCredito: e.target.value })}
              placeholder="0,00"
              className="tabular-nums"
            />
          </FormField>
        </div>
      </FormSection>

      {clienteId ? (
        <FormSection title="Logo do cliente (portal)" icon={ImagePlus}>
          <LogoUploadCard
            spec={
              clienteLogoSpec ?? {
                titulo: "Logo do cliente",
                ondeAparece: "Portal do cliente, ao lado do nome da empresa logada",
                descricao: "Marca do cliente (não da RL). Fundo transparente.",
                formatos: "PNG, WEBP ou SVG",
                dimensoes: "512 × 512 px (aceita 256–1024)",
                tamanhoMax: "400 KB",
              }
            }
            previewUrl={clienteLogo?.url}
            onUpload={async (file) => {
              try {
                const out = await uploadClienteLogo(clienteId, file);
                setClienteLogo(out);
                toast.success("Logo do cliente atualizada.");
              } catch (err) {
                toast.error(err instanceof ApiError ? err.message : "Falha no upload da logo.");
                throw err;
              }
            }}
            onRemove={async () => {
              try {
                await deleteClienteLogo(clienteId);
                setClienteLogo(null);
                toast.success("Logo do cliente removida.");
              } catch (err) {
                toast.error(err instanceof ApiError ? err.message : "Não foi possível remover.");
              }
            }}
          />
        </FormSection>
      ) : (
        <p className="text-xs text-muted-foreground">
          Salve o cadastro primeiro para anexar a logo que aparece no portal.
        </p>
      )}

      <FormSection title="Observações" icon={FileText}>
        <textarea
          value={formData.observacoes}
          onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
          placeholder="Anotações gerais..."
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </FormSection>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={formData.ativo}
            onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
            className="h-4 w-4 rounded border-border"
          />
          <span className="text-sm">Cadastro ativo</span>
        </label>
        {!formData.ativo ? (
          <p className="text-xs text-amber-400">
            Inativos não aparecem em novas solicitações, mas mantêm histórico.
          </p>
        ) : null}
      </div>

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={() => router.push("/cadastros/pessoas/clientes")}>
          <X className="mr-2 h-4 w-4" />
          Cancelar
        </Button>
        <Button type="submit" variant="default" disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" /> {clienteId ? "Atualizar" : "Cadastrar"}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
