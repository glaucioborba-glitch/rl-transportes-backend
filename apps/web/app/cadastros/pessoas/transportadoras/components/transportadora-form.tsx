"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, MapPin, Phone, Save, Truck, Wallet, X } from "lucide-react";
import { FormField, FormSection } from "@/components/cadastros/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/staff-client";
import { validateCadastrosCnpj } from "@/lib/api/cadastros-clientes-client";
import {
  buscaCepTransportadora,
  createCadastrosTransportadora,
  EMPTY_TRANSPORTADORA_FORM,
  getCadastrosTransportadora,
  updateCadastrosTransportadora,
  validateCadastrosRntrc,
  type CadastrosTransportadoraFormData,
} from "@/lib/api/cadastros-transportadoras-client";
import { formatCEP, formatCNPJ, formatPhone, isValidCNPJ } from "@/lib/cadastros/formatters";
import { toast } from "@/lib/toast";

const SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const TIPOS_VEICULO = [
  "LS",
  "TOCO",
  "TRUCK",
  "RODOTREM",
  "CARRETA_SIMPLES",
  "CARRETA_ESTENDIDA",
] as const;

type Props = {
  transportadoraId?: string;
};

export function TransportadoraForm({ transportadoraId }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(transportadoraId));
  const [validatingCnpj, setValidatingCnpj] = useState(false);
  const [validatingRntrc, setValidatingRntrc] = useState(false);
  const [formData, setFormData] = useState<CadastrosTransportadoraFormData>(
    EMPTY_TRANSPORTADORA_FORM,
  );

  useEffect(() => {
    if (!transportadoraId) return;
    let on = true;
    void (async () => {
      try {
        const data = await getCadastrosTransportadora(transportadoraId);
        if (on) {
          setFormData({
            ...EMPTY_TRANSPORTADORA_FORM,
            ...data,
            tiposVeiculo: data.tiposVeiculo ?? [],
            rotasAutorizadas: data.rotasAutorizadas ?? [],
          });
        }
      } catch {
        toast.error("Erro ao carregar transportadora.");
      } finally {
        if (on) setLoading(false);
      }
    })();
    return () => {
      on = false;
    };
  }, [transportadoraId]);

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
          bairro: data.bairro || prev.bairro,
          cidade: data.cidade || prev.cidade,
          uf: data.uf || prev.uf,
          email: data.email || prev.email,
          telefone: data.telefone || prev.telefone,
        }));
        toast.success("CNPJ validado e dados preenchidos.");
      } else {
        toast.info("CNPJ válido, mas não foi possível buscar dados automáticos.");
      }
    } catch {
      toast.info("CNPJ válido, mas não foi possível buscar dados automáticos.");
    } finally {
      setValidatingCnpj(false);
    }
  };

  const validateRntrc = async (rntrc: string) => {
    const clean = rntrc.replace(/\D/g, "");
    if (clean.length !== 8) return;

    setValidatingRntrc(true);
    try {
      const result = await validateCadastrosRntrc(clean);
      if (result.valido) {
        toast.success("RNTRC válido.");
        setFormData((prev) => ({
          ...prev,
          razaoSocial: result.razaoSocial || prev.razaoSocial,
          rntrcValidade: result.validade || prev.rntrcValidade,
        }));
        if (result.aviso) toast.info(result.aviso);
      } else {
        toast.error(result.message || "RNTRC inválido ou não encontrado na ANTT.");
      }
    } catch {
      toast.info("Não foi possível validar o RNTRC online. Verifique manualmente.");
    } finally {
      setValidatingRntrc(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.razaoSocial || !formData.cnpj) {
      toast.error("Razão Social e CNPJ são obrigatórios.");
      return;
    }
    if (!isValidCNPJ(formData.cnpj)) {
      toast.error("CNPJ inválido.");
      return;
    }

    setSaving(true);
    try {
      if (transportadoraId) {
        await updateCadastrosTransportadora(transportadoraId, formData);
        toast.success("Transportadora atualizada!");
      } else {
        await createCadastrosTransportadora(formData);
        toast.success("Transportadora cadastrada!");
      }
      router.push("/cadastros/pessoas/transportadoras");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Erro ao salvar transportadora.";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Carregando…
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl space-y-8">
      <FormSection title="Dados Cadastrais" icon={Truck}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Razão Social" required>
            <Input
              value={formData.razaoSocial}
              onChange={(e) => setFormData({ ...formData, razaoSocial: e.target.value })}
              placeholder="Ex: Expresso Portuário SC LTDA"
            />
          </FormField>
          <FormField label="Nome Fantasia">
            <Input
              value={formData.nomeFantasia}
              onChange={(e) => setFormData({ ...formData, nomeFantasia: e.target.value })}
              placeholder="Ex: Expresso SC"
            />
          </FormField>
          <FormField label="CNPJ" required>
            <div className="flex gap-2">
              <Input
                value={formatCNPJ(formData.cnpj)}
                onChange={(e) =>
                  setFormData({ ...formData, cnpj: e.target.value.replace(/\D/g, "") })
                }
                onBlur={(e) => void validateCnpj(e.target.value)}
                placeholder="00.000.000/0000-00"
                className="tabular-nums"
              />
              {validatingCnpj ? (
                <Loader2 className="h-4 w-4 animate-spin self-center text-muted-foreground" />
              ) : null}
            </div>
          </FormField>
          <FormField label="Inscrição Estadual">
            <Input
              value={formData.ie}
              onChange={(e) => setFormData({ ...formData, ie: e.target.value })}
              placeholder="000.000.000.000"
              className="tabular-nums"
            />
          </FormField>
          <FormField label="RNTRC (ANTT)">
            <div className="flex gap-2">
              <Input
                value={formData.rntrc}
                onChange={(e) =>
                  setFormData({ ...formData, rntrc: e.target.value.replace(/\D/g, "") })
                }
                onBlur={(e) => void validateRntrc(e.target.value)}
                placeholder="00000000"
                maxLength={8}
                className="tabular-nums"
              />
              {validatingRntrc ? (
                <Loader2 className="h-4 w-4 animate-spin self-center text-muted-foreground" />
              ) : null}
            </div>
          </FormField>
          <FormField label="Validade RNTRC">
            <Input
              type="date"
              value={formData.rntrcValidade}
              onChange={(e) => setFormData({ ...formData, rntrcValidade: e.target.value })}
            />
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Endereço" icon={MapPin}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <FormField label="CEP">
            <Input
              value={formatCEP(formData.cep)}
              onChange={(e) => setFormData({ ...formData, cep: e.target.value.replace(/\D/g, "") })}
              onBlur={(e) => void buscaCepTransportadora(e.target.value, setFormData)}
              placeholder="00000-000"
              className="tabular-nums"
            />
          </FormField>
          <FormField label="Endereço" className="md:col-span-2">
            <Input
              value={formData.endereco}
              onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
            />
          </FormField>
          <FormField label="Número">
            <Input
              value={formData.numero}
              onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
            />
          </FormField>
          <FormField label="Complemento">
            <Input
              value={formData.complemento}
              onChange={(e) => setFormData({ ...formData, complemento: e.target.value })}
            />
          </FormField>
          <FormField label="Bairro">
            <Input
              value={formData.bairro}
              onChange={(e) => setFormData({ ...formData, bairro: e.target.value })}
            />
          </FormField>
          <FormField label="Cidade">
            <Input
              value={formData.cidade}
              onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
            />
          </FormField>
          <FormField label="UF">
            <Input
              value={formData.uf}
              onChange={(e) =>
                setFormData({ ...formData, uf: e.target.value.toUpperCase() })
              }
              maxLength={2}
            />
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Contato" icon={Phone}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="E-mail">
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="contato@transportadora.com.br"
            />
          </FormField>
          <FormField label="Telefone">
            <Input
              value={formatPhone(formData.telefone)}
              onChange={(e) =>
                setFormData({ ...formData, telefone: e.target.value.replace(/\D/g, "") })
              }
              placeholder="(00) 0000-0000"
              className="tabular-nums"
            />
          </FormField>
          <FormField label="Celular">
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

      <FormSection title="Frota" icon={Truck}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Total de Veículos">
            <Input
              type="number"
              value={formData.frotaTotal}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  frotaTotal: parseInt(e.target.value, 10) || 0,
                })
              }
              placeholder="0"
              className="tabular-nums"
            />
          </FormField>
          <FormField label="Tipos de Veículo">
            <div className="mt-1 flex flex-wrap gap-2">
              {TIPOS_VEICULO.map((tipo) => (
                <label key={tipo} className="flex cursor-pointer items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={formData.tiposVeiculo.includes(tipo)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData((prev) => ({
                          ...prev,
                          tiposVeiculo: [...prev.tiposVeiculo, tipo],
                        }));
                      } else {
                        setFormData((prev) => ({
                          ...prev,
                          tiposVeiculo: prev.tiposVeiculo.filter((t) => t !== tipo),
                        }));
                      }
                    }}
                    className="h-3.5 w-3.5 rounded border-border"
                  />
                  {tipo.replace(/_/g, " ")}
                </label>
              ))}
            </div>
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Dados Financeiros" icon={Wallet}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Condição de Pagamento">
            <select
              value={formData.condicaoPagamento}
              onChange={(e) =>
                setFormData({ ...formData, condicaoPagamento: e.target.value })
              }
              className={SELECT_CLASS}
            >
              <option value="">Selecione...</option>
              <option value="A_VISTA">À vista</option>
              <option value="15_DIAS">15 dias</option>
              <option value="30_DIAS">30 dias</option>
              <option value="30_60">30/60 dias</option>
            </select>
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Observações" icon={FileText}>
        <textarea
          value={formData.observacoes}
          onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
          placeholder="Anotações sobre rotas preferenciais, restrições, etc..."
          rows={4}
          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </FormSection>

      <div className="flex items-center gap-3">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={formData.ativo}
            onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
            className="h-4 w-4 rounded border-border"
          />
          <span className="text-sm">Transportadora ativa</span>
        </label>
      </div>

      <div className="sticky bottom-0 -mx-6 flex gap-3 border-t border-border bg-background/95 p-4 backdrop-blur">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          <X className="mr-2 h-4 w-4" /> Cancelar
        </Button>
        <Button variant="default" type="submit" disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />{" "}
              {transportadoraId ? "Atualizar" : "Cadastrar"} Transportadora
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
