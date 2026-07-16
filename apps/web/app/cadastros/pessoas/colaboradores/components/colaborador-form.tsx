"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  Building2,
  Calendar,
  FileText,
  Loader2,
  Save,
  User,
  Wallet,
  X,
} from "lucide-react";
import { FormField, FormSection } from "@/components/cadastros/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/staff-client";
import {
  buscaCepColaborador,
  checkCadastrosColaboradorCpf,
  createCadastrosColaborador,
  EMPTY_COLABORADOR_FORM,
  fetchCadastrosCentrosCusto,
  fetchCadastrosGestores,
  getCadastrosColaborador,
  updateCadastrosColaborador,
  type CadastrosColaboradorFormData,
  type CentroCustoRef,
  type GestorRef,
} from "@/lib/api/cadastros-colaboradores-client";
import {
  formatCEP,
  formatCPF,
  formatPhone,
  formatPIS,
  isValidCPF,
  isValidPIS,
} from "@/lib/cadastros/formatters";
import { toast } from "@/lib/toast";

const SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type Props = {
  colaboradorId?: string;
};

export function ColaboradorForm({ colaboradorId }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(colaboradorId));
  const [validatingCpf, setValidatingCpf] = useState(false);
  const [gestores, setGestores] = useState<GestorRef[]>([]);
  const [centrosCusto, setCentrosCusto] = useState<CentroCustoRef[]>([]);
  const [formData, setFormData] = useState<CadastrosColaboradorFormData>(EMPTY_COLABORADOR_FORM);

  useEffect(() => {
    void (async () => {
      try {
        const [g, c] = await Promise.all([fetchCadastrosGestores(), fetchCadastrosCentrosCusto()]);
        setGestores(g);
        setCentrosCusto(c);
      } catch {
        /* aux endpoints opcionais */
      }
    })();
  }, []);

  useEffect(() => {
    if (!colaboradorId) return;
    let on = true;
    void (async () => {
      try {
        const data = await getCadastrosColaborador(colaboradorId);
        if (on) {
          setFormData({
            ...EMPTY_COLABORADOR_FORM,
            ...data,
            jornadaSemanal: Number(data.jornadaSemanal) || 44,
          });
        }
      } catch {
        toast.error("Erro ao carregar colaborador.");
      } finally {
        if (on) setLoading(false);
      }
    })();
    return () => {
      on = false;
    };
  }, [colaboradorId]);

  const validateCpf = async (cpf: string) => {
    const clean = cpf.replace(/\D/g, "");
    if (clean.length !== 11) return;

    setValidatingCpf(true);
    try {
      if (!isValidCPF(clean)) {
        toast.error("CPF inválido — dígitos verificadores não conferem.");
        return;
      }
      const result = await checkCadastrosColaboradorCpf(clean, colaboradorId);
      if (result.exists) {
        toast.error(
          `CPF já cadastrado: ${result.nome} (matrícula ${result.matricula ?? "—"}).`,
        );
      }
    } catch {
      /* endpoint opcional */
    } finally {
      setValidatingCpf(false);
    }
  };

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
    if (formData.pis && !isValidPIS(formData.pis)) {
      toast.error("PIS/PASEP inválido.");
      return;
    }
    if (!formData.dataAdmissao) {
      toast.error("Data de admissão é obrigatória.");
      return;
    }

    setSaving(true);
    try {
      if (colaboradorId) {
        await updateCadastrosColaborador(colaboradorId, formData);
        toast.success("Colaborador atualizado com sucesso!");
      } else {
        await createCadastrosColaborador(formData);
        toast.success("Colaborador cadastrado com sucesso!");
      }
      router.push("/cadastros/pessoas/colaboradores");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao salvar colaborador.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Carregando colaborador…
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
              placeholder="Ex: João da Silva Santos"
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
                disabled={Boolean(colaboradorId)}
              />
              {validatingCpf ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin self-center text-muted-foreground" />
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
          <FormField label="PIS/PASEP">
            <Input
              value={formatPIS(formData.pis)}
              onChange={(e) =>
                setFormData({ ...formData, pis: e.target.value.replace(/\D/g, "") })
              }
              placeholder="000.00000.00-0"
              className="tabular-nums"
            />
          </FormField>
          <FormField label="Sexo">
            <select
              value={formData.sexo}
              onChange={(e) => setFormData({ ...formData, sexo: e.target.value })}
              className={SELECT_CLASS}
            >
              <option value="">Selecione...</option>
              <option value="M">Masculino</option>
              <option value="F">Feminino</option>
              <option value="O">Outro</option>
            </select>
          </FormField>
          <FormField label="Estado Civil">
            <select
              value={formData.estadoCivil}
              onChange={(e) => setFormData({ ...formData, estadoCivil: e.target.value })}
              className={SELECT_CLASS}
            >
              <option value="">Selecione...</option>
              <option value="SOLTEIRO">Solteiro(a)</option>
              <option value="CASADO">Casado(a)</option>
              <option value="DIVORCIADO">Divorciado(a)</option>
              <option value="VIUVO">Viúvo(a)</option>
              <option value="UNIAO_ESTAVEL">União Estável</option>
            </select>
          </FormField>
          <FormField label="Nacionalidade">
            <Input
              value={formData.nacionalidade}
              onChange={(e) => setFormData({ ...formData, nacionalidade: e.target.value })}
            />
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Endereço" icon={Building2}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <FormField label="CEP">
            <Input
              value={formatCEP(formData.cep)}
              onChange={(e) => setFormData({ ...formData, cep: e.target.value.replace(/\D/g, "") })}
              onBlur={(e) => void buscaCepColaborador(e.target.value, setFormData)}
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
                setFormData({ ...formData, uf: e.target.value.toUpperCase().slice(0, 2) })
              }
              maxLength={2}
            />
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Contato" icon={User}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="E-mail">
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="joao@rltransportes.com"
            />
          </FormField>
          <FormField label="Telefone">
            <Input
              value={formatPhone(formData.telefone)}
              onChange={(e) =>
                setFormData({ ...formData, telefone: e.target.value.replace(/\D/g, "") })
              }
              className="tabular-nums"
            />
          </FormField>
          <FormField label="Celular">
            <Input
              value={formatPhone(formData.celular)}
              onChange={(e) =>
                setFormData({ ...formData, celular: e.target.value.replace(/\D/g, "") })
              }
              className="tabular-nums"
            />
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Dados Admissionais" icon={Briefcase}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <FormField label="Matrícula">
            <Input
              value={formData.matricula}
              onChange={(e) => setFormData({ ...formData, matricula: e.target.value })}
              placeholder="0001"
              className="tabular-nums"
            />
          </FormField>
          <FormField label="Data de Admissão" required>
            <Input
              type="date"
              value={formData.dataAdmissao}
              onChange={(e) => setFormData({ ...formData, dataAdmissao: e.target.value })}
            />
          </FormField>
          <FormField label="Cargo">
            <Input
              value={formData.cargo}
              onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
              placeholder="Ex: Operador de Empilhadeira"
            />
          </FormField>
          <FormField label="Departamento">
            <select
              value={formData.departamento}
              onChange={(e) => setFormData({ ...formData, departamento: e.target.value })}
              className={SELECT_CLASS}
            >
              <option value="">Selecione...</option>
              <option value="OPERACIONAL">Operacional</option>
              <option value="GATE">Gate CPO</option>
              <option value="PATIO">Pátio</option>
              <option value="ADMINISTRATIVO">Administrativo</option>
              <option value="FINANCEIRO">Financeiro</option>
              <option value="RH">Recursos Humanos</option>
              <option value="SSMA">SSMA</option>
              <option value="TI">Tecnologia da Informação</option>
            </select>
          </FormField>
          <FormField label="Gestor Responsável">
            <select
              value={formData.gestorId}
              onChange={(e) => setFormData({ ...formData, gestorId: e.target.value })}
              className={SELECT_CLASS}
            >
              <option value="">Selecione...</option>
              {gestores
                .filter((g) => g.id !== colaboradorId)
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nome}
                  </option>
                ))}
            </select>
          </FormField>
          <FormField label="Vínculo">
            <select
              value={formData.vinculo}
              onChange={(e) => setFormData({ ...formData, vinculo: e.target.value })}
              className={SELECT_CLASS}
            >
              <option value="CLT">CLT</option>
              <option value="TERCEIRIZADO">Terceirizado</option>
              <option value="ESTAGIARIO">Estagiário</option>
              <option value="TEMPORARIO">Temporário</option>
              <option value="PRESTADOR">Prestador PJ</option>
            </select>
          </FormField>
          <FormField label="Regime de Trabalho">
            <select
              value={formData.regimeTrabalho}
              onChange={(e) => setFormData({ ...formData, regimeTrabalho: e.target.value })}
              className={SELECT_CLASS}
            >
              <option value="CLT_44">CLT 44h (Integral)</option>
              <option value="CLT_36">CLT 36h (Reduzida)</option>
              <option value="CLT_220">CLT 220h/mês</option>
              <option value="PARCIAL_25">Parcial 25h</option>
              <option value="PARCIAL_30">Parcial 30h</option>
              <option value="ESTAGIO_30">Estágio 30h</option>
              <option value="ESTAGIO_20">Estágio 20h</option>
            </select>
          </FormField>
          <FormField label="Jornada Semanal (h)">
            <Input
              type="number"
              value={formData.jornadaSemanal}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  jornadaSemanal: parseInt(e.target.value, 10) || 0,
                })
              }
              className="tabular-nums"
            />
          </FormField>
          <FormField label="Turno">
            <select
              value={formData.turno}
              onChange={(e) => setFormData({ ...formData, turno: e.target.value })}
              className={SELECT_CLASS}
            >
              <option value="T1">T1 (06:00 - 14:00)</option>
              <option value="T2">T2 (14:00 - 22:00)</option>
              <option value="T3">T3 (22:00 - 06:00)</option>
              <option value="MISTA">Misto</option>
            </select>
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Dados Financeiros" icon={Wallet}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <FormField label="Centro de Custo">
            <select
              value={formData.centroCustoId}
              onChange={(e) => setFormData({ ...formData, centroCustoId: e.target.value })}
              className={SELECT_CLASS}
            >
              <option value="">Selecione...</option>
              {centrosCusto.map((cc) => (
                <option key={cc.codigo} value={`${cc.codigo}|${cc.nome}`}>
                  {cc.codigo} · {cc.nome}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Salário Base (R$)">
            <Input
              type="number"
              step="0.01"
              value={formData.salario}
              onChange={(e) => setFormData({ ...formData, salario: e.target.value })}
              className="tabular-nums"
            />
          </FormField>
          <FormField label="Conta Bancária">
            <Input
              value={formData.contaBancaria}
              onChange={(e) => setFormData({ ...formData, contaBancaria: e.target.value })}
              placeholder="Banco / Agência / Conta"
            />
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Carteira Nacional de Habilitação (CNH)" icon={FileText}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <FormField label="Número da CNH">
            <Input
              value={formData.cnhNumero}
              onChange={(e) => setFormData({ ...formData, cnhNumero: e.target.value })}
              className="tabular-nums"
            />
          </FormField>
          <FormField label="Categoria">
            <select
              value={formData.cnhCategoria}
              onChange={(e) => setFormData({ ...formData, cnhCategoria: e.target.value })}
              className={SELECT_CLASS}
            >
              <option value="">Sem CNH</option>
              <option value="A">A (Moto)</option>
              <option value="B">B (Carro)</option>
              <option value="C">C (Caminhão)</option>
              <option value="D">D (Ônibus)</option>
              <option value="E">E (Carreta)</option>
              <option value="AB">AB</option>
              <option value="AD">AD</option>
              <option value="AE">AE</option>
            </select>
          </FormField>
          <FormField label="Validade">
            <Input
              type="date"
              value={formData.cnhValidade}
              onChange={(e) => setFormData({ ...formData, cnhValidade: e.target.value })}
            />
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Status e Observações" icon={Calendar}>
        <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Status">
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className={SELECT_CLASS}
            >
              <option value="ATIVO">Ativo</option>
              <option value="AFASTADO">Afastado (maternidade, médica, etc.)</option>
              <option value="FERIAS">Férias</option>
              <option value="INATIVO">Inativo (demitido)</option>
            </select>
          </FormField>
          {formData.status === "INATIVO" ? (
            <>
              <FormField label="Data de Demissão">
                <Input
                  type="date"
                  value={formData.dataDemissao}
                  onChange={(e) => setFormData({ ...formData, dataDemissao: e.target.value })}
                />
              </FormField>
              <FormField label="Motivo da Demissão" className="md:col-span-2">
                <select
                  value={formData.motivoDemissao}
                  onChange={(e) => setFormData({ ...formData, motivoDemissao: e.target.value })}
                  className={SELECT_CLASS}
                >
                  <option value="">Selecione...</option>
                  <option value="RESIGNACAO">Resignação (pedido)</option>
                  <option value="DISPENSA_SEM_JUSTA">Dispensa sem justa causa</option>
                  <option value="DISPENSA_JUSTA">Dispensa por justa causa</option>
                  <option value="TERMINO_CONTRATO">Término de contrato</option>
                  <option value="APOSENTADORIA">Aposentadoria</option>
                  <option value="FALECIMENTO">Falecimento</option>
                </select>
              </FormField>
            </>
          ) : null}
        </div>
        <FormField label="Observações">
          <textarea
            value={formData.observacoes}
            onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
            rows={4}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Anotações gerais sobre o colaborador..."
          />
        </FormField>
      </FormSection>

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
              <Save className="mr-2 h-4 w-4" />{" "}
              {colaboradorId ? "Atualizar" : "Cadastrar"} Colaborador
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
