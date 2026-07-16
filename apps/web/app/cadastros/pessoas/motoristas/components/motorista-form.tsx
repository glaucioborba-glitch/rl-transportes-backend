"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  FileText,
  IdCard,
  Loader2,
  MapPin,
  Phone,
  Save,
  Truck,
  User,
  X,
} from "lucide-react";
import { FormField, FormSection } from "@/components/cadastros/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/staff-client";
import {
  buscaCepMotorista,
  checkCadastrosMotoristaCpf,
  createCadastrosMotorista,
  EMPTY_MOTORISTA_FORM,
  getCadastrosMotorista,
  updateCadastrosMotorista,
  type CadastrosMotoristaFormData,
} from "@/lib/api/cadastros-motoristas-client";
import {
  listCadastrosTransportadoras,
  type CadastrosTransportadoraListItem,
} from "@/lib/api/cadastros-transportadoras-client";
import { formatCEP, formatCNPJ, formatCPF, formatPhone, isValidCPF } from "@/lib/cadastros/formatters";
import { toast } from "@/lib/toast";

const SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type Props = {
  motoristaId?: string;
};

export function MotoristaForm({ motoristaId }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(motoristaId));
  const [validatingCpf, setValidatingCpf] = useState(false);
  const [transportadoras, setTransportadoras] = useState<CadastrosTransportadoraListItem[]>([]);
  const [formData, setFormData] = useState<CadastrosMotoristaFormData>(EMPTY_MOTORISTA_FORM);

  useEffect(() => {
    void (async () => {
      try {
        const data = await listCadastrosTransportadoras({
          status: "ativas",
          limit: 100,
        });
        setTransportadoras(data.items || []);
      } catch {
        /* aux opcional */
      }
    })();
  }, []);

  useEffect(() => {
    if (!motoristaId) return;
    let on = true;
    void (async () => {
      try {
        const data = await getCadastrosMotorista(motoristaId);
        if (on) setFormData({ ...EMPTY_MOTORISTA_FORM, ...data });
      } catch {
        toast.error("Erro ao carregar motorista.");
      } finally {
        if (on) setLoading(false);
      }
    })();
    return () => {
      on = false;
    };
  }, [motoristaId]);

  const validateCpf = async (cpf: string) => {
    const clean = cpf.replace(/\D/g, "");
    if (clean.length !== 11) return;

    setValidatingCpf(true);
    try {
      if (!isValidCPF(clean)) {
        toast.error("CPF inválido.");
        return;
      }
      const result = await checkCadastrosMotoristaCpf(clean, motoristaId);
      if (result.exists) {
        toast.error(`CPF já cadastrado: ${result.nome}`);
      }
    } catch {
      /* não bloqueia */
    } finally {
      setValidatingCpf(false);
    }
  };

  const cnhVencida =
    formData.cnhValidade &&
    new Date(`${formData.cnhValidade}T12:00:00`) < new Date(new Date().toDateString());
  const cnhVencendo =
    formData.cnhValidade &&
    !cnhVencida &&
    new Date(`${formData.cnhValidade}T12:00:00`) <
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome || !formData.cpf) {
      toast.error("Nome e CPF são obrigatórios.");
      return;
    }
    if (!isValidCPF(formData.cpf)) {
      toast.error("CPF inválido.");
      return;
    }
    if (!formData.transportadoraId) {
      toast.error("Transportadora é obrigatória — todo motorista deve ser vinculado a uma.");
      return;
    }
    if (!formData.cnhNumero || !formData.cnhCategoria || !formData.cnhValidade) {
      toast.error("Dados da CNH são obrigatórios (número, categoria e validade).");
      return;
    }

    const validade = new Date(`${formData.cnhValidade}T12:00:00`);
    if (validade < new Date(new Date().toDateString())) {
      toast.warning(
        "ATENÇÃO: A CNH informada está vencida. O motorista será bloqueado no Gate CPO.",
      );
    }

    setSaving(true);
    try {
      if (motoristaId) {
        await updateCadastrosMotorista(motoristaId, formData);
        toast.success("Motorista atualizado!");
      } else {
        await createCadastrosMotorista(formData);
        toast.success("Motorista cadastrado!");
      }
      router.push("/cadastros/pessoas/motoristas");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Erro ao salvar motorista.";
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
      <FormSection title="Dados Pessoais" icon={User}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <FormField label="Nome Completo" required className="md:col-span-2">
            <Input
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              placeholder="Ex: Carlos Eduardo Ferreira"
            />
          </FormField>
          <FormField label="Data de Nascimento">
            <Input
              type="date"
              value={formData.dataNascimento}
              onChange={(e) => setFormData({ ...formData, dataNascimento: e.target.value })}
            />
          </FormField>
          <FormField label="CPF" required>
            <div className="flex gap-2">
              <Input
                value={formatCPF(formData.cpf)}
                onChange={(e) =>
                  setFormData({ ...formData, cpf: e.target.value.replace(/\D/g, "") })
                }
                onBlur={(e) => void validateCpf(e.target.value)}
                placeholder="000.000.000-00"
                className="tabular-nums"
              />
              {validatingCpf ? (
                <Loader2 className="h-4 w-4 animate-spin self-center text-muted-foreground" />
              ) : null}
            </div>
          </FormField>
          <FormField label="RG">
            <Input
              value={formData.rg}
              onChange={(e) => setFormData({ ...formData, rg: e.target.value })}
              placeholder="00.000.000-0"
              className="tabular-nums"
            />
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Transportadora" icon={Truck}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Transportadora Vinculada" required>
            <select
              value={formData.transportadoraId}
              onChange={(e) =>
                setFormData({ ...formData, transportadoraId: e.target.value })
              }
              className={SELECT_CLASS}
            >
              <option value="">Selecione uma transportadora...</option>
              {transportadoras.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.razaoSocial} — {formatCNPJ(t.cnpj)}
                </option>
              ))}
            </select>
            {transportadoras.length === 0 ? (
              <p className="mt-1 text-xs text-amber-400">
                ⚠ Nenhuma transportadora ativa cadastrada. Cadastre uma transportadora primeiro.
              </p>
            ) : null}
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Carteira Nacional de Habilitação (CNH)" icon={IdCard}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <FormField label="Número da CNH" required>
            <Input
              value={formData.cnhNumero}
              onChange={(e) => setFormData({ ...formData, cnhNumero: e.target.value })}
              placeholder="00000000000"
              className="tabular-nums"
            />
          </FormField>
          <FormField label="Categoria" required>
            <select
              value={formData.cnhCategoria}
              onChange={(e) => setFormData({ ...formData, cnhCategoria: e.target.value })}
              className={SELECT_CLASS}
            >
              <option value="">Selecione...</option>
              <option value="A">A (Moto)</option>
              <option value="B">B (Carro)</option>
              <option value="C">C (Caminhão)</option>
              <option value="D">D (Ônibus)</option>
              <option value="E">E (Carreta)</option>
              <option value="AB">AB</option>
              <option value="AC">AC</option>
              <option value="AD">AD</option>
              <option value="AE">AE</option>
            </select>
          </FormField>
          <FormField label="Validade" required>
            <Input
              type="date"
              value={formData.cnhValidade}
              onChange={(e) => setFormData({ ...formData, cnhValidade: e.target.value })}
            />
          </FormField>
          <FormField label="UF Emissão">
            <Input
              value={formData.cnhUfEmissao}
              onChange={(e) =>
                setFormData({ ...formData, cnhUfEmissao: e.target.value.toUpperCase() })
              }
              placeholder="SC"
              maxLength={2}
            />
          </FormField>
        </div>
        {cnhVencida ? (
          <div className="mt-3 flex items-center gap-2 rounded bg-red-500/10 px-3 py-2 text-xs text-red-400">
            <AlertTriangle className="h-4 w-4" />
            Esta CNH está VENCIDA. O motorista será bloqueado automaticamente no Gate CPO até a
            renovação.
          </div>
        ) : null}
        {cnhVencendo ? (
          <div className="mt-3 flex items-center gap-2 rounded bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
            <AlertTriangle className="h-4 w-4" />
            Esta CNH vence em menos de 30 dias. Renove antes do vencimento para evitar bloqueio.
          </div>
        ) : null}
      </FormSection>

      <FormSection title="Endereço" icon={MapPin}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <FormField label="CEP">
            <Input
              value={formatCEP(formData.cep)}
              onChange={(e) => setFormData({ ...formData, cep: e.target.value.replace(/\D/g, "") })}
              onBlur={(e) => void buscaCepMotorista(e.target.value, setFormData)}
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
              onChange={(e) => setFormData({ ...formData, uf: e.target.value.toUpperCase() })}
              maxLength={2}
            />
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Contato" icon={Phone}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
          <FormField label="E-mail">
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="carlos@email.com"
            />
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Observações" icon={FileText}>
        <textarea
          value={formData.observacoes}
          onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
          placeholder="Restrições médicas, observações de segurança, etc..."
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
          <span className="text-sm">Motorista ativo</span>
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
              <Save className="mr-2 h-4 w-4" /> {motoristaId ? "Atualizar" : "Cadastrar"} Motorista
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
