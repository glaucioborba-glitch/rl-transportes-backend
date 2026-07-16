"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, FileText, Loader2, MapPin, Phone, Save, X } from "lucide-react";
import { FormField, FormSection } from "@/components/cadastros/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/staff-client";
import {
  buscarCadastrosCep,
  createCadastrosCliente,
  EMPTY_CLIENTE_FORM,
  getCadastrosCliente,
  updateCadastrosCliente,
  validateCadastrosCnpj,
  type CadastrosClienteFormData,
} from "@/lib/api/cadastros-clientes-client";
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

  useEffect(() => {
    if (!clienteId) return;
    let on = true;
    void (async () => {
      try {
        const data = await getCadastrosCliente(clienteId);
        if (on) setFormData(data);
      } catch {
        toast.error("Erro ao carregar cliente.");
      } finally {
        if (on) setLoading(false);
      }
    })();
    return () => {
      on = false;
    };
  }, [clienteId]);

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

    setSaving(true);
    try {
      if (clienteId) {
        await updateCadastrosCliente(clienteId, formData);
        toast.success("Cliente atualizado com sucesso!");
      } else {
        await createCadastrosCliente(formData);
        toast.success("Cliente cadastrado com sucesso!");
      }
      router.push("/cadastros/pessoas/clientes");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao salvar cliente.");
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
    <form onSubmit={handleSubmit} className="max-w-4xl space-y-8">
      <FormSection title="Dados Cadastrais" icon={Building2}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Razão Social" required>
            <Input
              value={formData.razaoSocial}
              onChange={(e) => setFormData({ ...formData, razaoSocial: e.target.value })}
              placeholder="Ex: RL Transportes, Carga e Descarga LTDA"
            />
          </FormField>

          <FormField label="Nome Fantasia">
            <Input
              value={formData.nomeFantasia}
              onChange={(e) => setFormData({ ...formData, nomeFantasia: e.target.value })}
              placeholder="Ex: RL Transportes"
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
                disabled={Boolean(clienteId)}
              />
              {validatingCnpj ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin self-center text-muted-foreground" />
              ) : null}
            </div>
          </FormField>

          <FormField label="Inscrição Estadual (IE)">
            <Input
              value={formData.ie}
              onChange={(e) => setFormData({ ...formData, ie: e.target.value })}
              placeholder="000.000.000.000"
              className="tabular-nums"
            />
          </FormField>

          <FormField label="Inscrição Municipal (IM)">
            <Input
              value={formData.im}
              onChange={(e) => setFormData({ ...formData, im: e.target.value })}
              placeholder="0000000"
              className="tabular-nums"
            />
          </FormField>

          <FormField label="Segmento">
            <select
              value={formData.segmento}
              onChange={(e) => setFormData({ ...formData, segmento: e.target.value })}
              className={SELECT_CLASS}
            >
              <option value="">Selecione...</option>
              <option value="EXPORTACAO">Exportação</option>
              <option value="IMPORTACAO">Importação</option>
              <option value="ARMAZENAGEM">Armazenagem</option>
              <option value="DISTRIBUICAO">Distribuição</option>
              <option value="CABOTAGEM">Cabotagem</option>
              <option value="OUTROS">Outros</option>
            </select>
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Endereço" icon={MapPin}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <FormField label="CEP">
            <div className="flex gap-2">
              <Input
                value={formatCEP(formData.cep)}
                onChange={(e) => setFormData({ ...formData, cep: e.target.value.replace(/\D/g, "") })}
                onBlur={(e) => void buscaCep(e.target.value)}
                placeholder="00000-000"
                className="tabular-nums"
              />
              {validatingCep ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin self-center text-muted-foreground" />
              ) : null}
            </div>
          </FormField>

          <FormField label="Endereço" className="md:col-span-2">
            <Input
              value={formData.endereco}
              onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
              placeholder="Rua, Avenida..."
            />
          </FormField>

          <FormField label="Número">
            <Input
              value={formData.numero}
              onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
              placeholder="123"
            />
          </FormField>

          <FormField label="Complemento">
            <Input
              value={formData.complemento}
              onChange={(e) => setFormData({ ...formData, complemento: e.target.value })}
              placeholder="Sala, Andar..."
            />
          </FormField>

          <FormField label="Bairro">
            <Input
              value={formData.bairro}
              onChange={(e) => setFormData({ ...formData, bairro: e.target.value })}
              placeholder="Centro"
            />
          </FormField>

          <FormField label="Cidade">
            <Input
              value={formData.cidade}
              onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
              placeholder="São Paulo"
            />
          </FormField>

          <FormField label="UF">
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
      </FormSection>

      <FormSection title="Contato" icon={Phone}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="E-mail" required>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="contato@empresa.com.br"
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

      <FormSection title="Dados Financeiros" icon={FileText}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Condição de Pagamento">
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

          <FormField label="Limite de Crédito (R$)">
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

      <FormSection title="Observações" icon={FileText}>
        <textarea
          value={formData.observacoes}
          onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
          placeholder="Anotações gerais sobre o cliente..."
          rows={4}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
          <span className="text-sm">Cliente ativo</span>
        </label>
        {!formData.ativo ? (
          <p className="text-xs text-amber-400">
            Clientes inativos não aparecem em novas solicitações, mas mantêm histórico.
          </p>
        ) : null}
      </div>

      <div className="sticky bottom-0 -mx-4 flex gap-3 border-t border-border bg-[#080a0d]/95 p-4 backdrop-blur lg:-mx-6">
        <Button type="button" variant="outline" onClick={() => router.back()}>
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
              <Save className="mr-2 h-4 w-4" /> {clienteId ? "Atualizar" : "Cadastrar"} Cliente
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
