"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  Building2,
  Calendar,
  FileText,
  KeyRound,
  Loader2,
  Save,
  User,
  Wallet,
  X,
} from "lucide-react";
import { FormField, FormSection, CADASTRO_FORM_CLASS } from "@/components/cadastros/form-field";
import { FamiliaresSection } from "@/components/cadastros/familiares-section";
import { PasswordStrengthPanel } from "@/components/portal/password-strength-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
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
  type ColaboradorFamiliarForm,
  type CentroCustoRef,
  type GestorRef,
} from "@/lib/api/cadastros-colaboradores-client";
import { fetchParametrosGerais, type TenantTurnoOperacionalConfig } from "@/lib/api/tenant-config-client";
import {
  formatCEP,
  formatCPF,
  formatPhone,
  formatPIS,
  isValidCPF,
  isValidPIS,
} from "@/lib/cadastros/formatters";
import { COLABORADOR_INTRANET_PERFIS } from "@/lib/rh/colaborador-intranet-perfis";
import { evaluatePassword } from "@/lib/security/password-validator";
import { toast } from "@/lib/toast";

const SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type Props = {
  colaboradorId?: string;
  basePath?: string;
};

export function ColaboradorForm({ colaboradorId, basePath = "/rh/colaboradores" }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(colaboradorId));
  const [validatingCpf, setValidatingCpf] = useState(false);
  const [gestores, setGestores] = useState<GestorRef[]>([]);
  const [centrosCusto, setCentrosCusto] = useState<CentroCustoRef[]>([]);
  const [turnos, setTurnos] = useState<TenantTurnoOperacionalConfig[]>([]);
  const [formData, setFormData] = useState<CadastrosColaboradorFormData>(EMPTY_COLABORADOR_FORM);
  const [familiares, setFamiliares] = useState<ColaboradorFamiliarForm[]>([]);
  const [senha, setSenha] = useState("");
  const [senhaConfirmacao, setSenhaConfirmacao] = useState("");

  const addFamiliar = () => {
    if (familiares.length >= 10) return;
    setFamiliares((prev) => [
      ...prev,
      { nome: "", cpf: "", dataAniversario: "", parentesco: "" },
    ]);
  };

  const updateFamiliar = (
    index: number,
    field: keyof ColaboradorFamiliarForm,
    value: string,
  ) => {
    setFamiliares((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const removeFamiliar = (index: number) => {
    setFamiliares((prev) => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    void (async () => {
      try {
        const [g, c, params] = await Promise.all([
          fetchCadastrosGestores(),
          fetchCadastrosCentrosCusto(),
          fetchParametrosGerais().catch(() => null),
        ]);
        setGestores(g);
        setCentrosCusto(c);
        const ativos = (params?.operacional?.turnos ?? []).filter((t) => t.ativo !== false);
        setTurnos(ativos);
        if (!colaboradorId && ativos[0]) {
          setFormData((prev) => ({ ...prev, turno: prev.turno || ativos[0].codigo || ativos[0].id }));
        }
      } catch {
        /* aux endpoints opcionais */
      }
    })();
  }, [colaboradorId]);

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
          setFamiliares(
            data.familiares?.map((f) => ({
              id: f.id,
              nome: f.nome,
              cpf: f.cpf ?? "",
              dataAniversario: f.dataAniversario ?? "",
              parentesco: f.parentesco ?? "",
            })) ?? [],
          );
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
    if (!formData.perfilIntranet) {
      toast.error("Informe o perfil de acesso à intranet.");
      return;
    }
    if (!formData.email.trim()) {
      toast.error("E-mail é obrigatório para o login da intranet.");
      return;
    }
    const senhaTrim = senha.trim();
    const confirmTrim = senhaConfirmacao.trim();
    if (!colaboradorId || senhaTrim || confirmTrim) {
      if (!senhaTrim) {
        toast.error("Informe a senha de acesso e a confirmação.");
        return;
      }
      if (senhaTrim !== confirmTrim) {
        toast.error("A senha e a confirmação não conferem.");
        return;
      }
      if (!evaluatePassword(senhaTrim).valid) {
        toast.error("A senha não atende aos requisitos mínimos de segurança.");
        return;
      }
    }

    const familiaresPayload = familiares
      .filter((f) => f.nome.trim().length > 0)
      .map((f) => ({
        ...(f.id ? { id: f.id } : {}),
        nome: f.nome.trim(),
        cpf: f.cpf?.replace(/\D/g, "") || undefined,
        dataAniversario: f.dataAniversario || undefined,
        parentesco: f.parentesco || undefined,
      }));
    for (const f of familiaresPayload) {
      if (f.cpf && !isValidCPF(f.cpf)) {
        toast.error(`CPF inválido para o familiar "${f.nome.trim()}".`);
        return;
      }
    }
    if (familiaresPayload.length > 10) {
      toast.error("Máximo de 10 familiares por colaborador.");
      return;
    }

    const optionalDate = (v: string) => (v.trim() ? v : undefined);
    const payload = {
      ...formData,
      dataNascimento: optionalDate(formData.dataNascimento),
      cnhValidade: optionalDate(formData.cnhValidade),
      dataDemissao: optionalDate(formData.dataDemissao),
      motivoDemissao: formData.motivoDemissao.trim() || undefined,
      familiares: familiaresPayload,
      ...(senhaTrim
        ? { senha: senhaTrim, senhaConfirmacao: confirmTrim }
        : {}),
    };

    setSaving(true);
    try {
      if (colaboradorId) {
        await updateCadastrosColaborador(colaboradorId, payload);
        toast.success("Colaborador atualizado com sucesso!");
      } else {
        await createCadastrosColaborador(payload);
        toast.success("Colaborador cadastrado com sucesso!");
      }
      router.push(basePath);
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
    <form onSubmit={handleSubmit} className={CADASTRO_FORM_CLASS}>
      <FormSection title="Dados Pessoais" icon={User}>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-4">
          <FormField label="Nome Completo" required className="min-w-[16rem] flex-[2]">
            <Input
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              placeholder="Ex: João da Silva Santos"
            />
          </FormField>
          <FormField label="Data de Nascimento" size="md">
            <Input
              type="date"
              value={formData.dataNascimento}
              onChange={(e) => setFormData({ ...formData, dataNascimento: e.target.value })}
            />
          </FormField>
          <FormField label="CPF" required size="md">
            <div className="flex items-center gap-2">
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
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
              ) : null}
            </div>
          </FormField>
          <FormField label="RG" size="md">
            <Input
              value={formData.rg}
              onChange={(e) => setFormData({ ...formData, rg: e.target.value })}
              placeholder="00.000.000-0"
              className="tabular-nums"
            />
          </FormField>
          <FormField label="PIS/PASEP" size="md">
            <Input
              value={formatPIS(formData.pis)}
              onChange={(e) =>
                setFormData({ ...formData, pis: e.target.value.replace(/\D/g, "") })
              }
              placeholder="000.00000.00-0"
              className="tabular-nums"
            />
          </FormField>
          <FormField label="Sexo" size="md">
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
          <FormField label="Estado Civil" className="min-w-[12rem] flex-1">
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
          <FormField label="Nacionalidade" className="min-w-[10rem] flex-1">
            <Input
              value={formData.nacionalidade}
              onChange={(e) => setFormData({ ...formData, nacionalidade: e.target.value })}
            />
          </FormField>
          </div>
        </div>
      </FormSection>

      <FormSection title="Endereço" icon={Building2}>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-4">
          <FormField label="CEP" size="sm">
            <Input
              value={formatCEP(formData.cep)}
              onChange={(e) => setFormData({ ...formData, cep: e.target.value.replace(/\D/g, "") })}
              onBlur={(e) => void buscaCepColaborador(e.target.value, setFormData)}
              placeholder="00000-000"
              className="tabular-nums"
            />
          </FormField>
          <FormField label="Endereço" className="min-w-[16rem] flex-[3]">
            <Input
              value={formData.endereco}
              onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
            />
          </FormField>
          <FormField label="Número" size="sm">
            <Input
              value={formData.numero}
              onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
            />
          </FormField>
          </div>
          <div className="flex flex-wrap gap-4">
          <FormField label="Complemento" className="min-w-[10rem] flex-1">
            <Input
              value={formData.complemento}
              onChange={(e) => setFormData({ ...formData, complemento: e.target.value })}
            />
          </FormField>
          <FormField label="Bairro" className="min-w-[10rem] flex-1">
            <Input
              value={formData.bairro}
              onChange={(e) => setFormData({ ...formData, bairro: e.target.value })}
            />
          </FormField>
          <FormField label="Cidade" className="min-w-[10rem] flex-1">
            <Input
              value={formData.cidade}
              onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
            />
          </FormField>
          <FormField label="UF" size="xs">
            <Input
              value={formData.uf}
              onChange={(e) =>
                setFormData({ ...formData, uf: e.target.value.toUpperCase().slice(0, 2) })
              }
              maxLength={2}
            />
          </FormField>
          </div>
        </div>
      </FormSection>

      <FormSection title="Contato" icon={User}>
        <div className="flex flex-wrap gap-4">
          <FormField label="E-mail" required className="min-w-[16rem] flex-[2]">
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="joao@rltransportes.com"
            />
          </FormField>
          <FormField label="Telefone" size="md">
            <Input
              value={formatPhone(formData.telefone)}
              onChange={(e) =>
                setFormData({ ...formData, telefone: e.target.value.replace(/\D/g, "") })
              }
              className="tabular-nums"
            />
          </FormField>
          <FormField label="Celular" size="md">
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
        <div className="flex flex-wrap gap-4">
          <FormField label="Matrícula" size="sm">
            <Input
              value={formData.matricula}
              onChange={(e) => setFormData({ ...formData, matricula: e.target.value })}
              placeholder="0001"
              className="tabular-nums"
            />
          </FormField>
          <FormField label="Data de Admissão" required size="md">
            <Input
              type="date"
              value={formData.dataAdmissao}
              onChange={(e) => setFormData({ ...formData, dataAdmissao: e.target.value })}
            />
          </FormField>
          <FormField label="Cargo" className="min-w-[14rem] flex-1">
            <Input
              value={formData.cargo}
              onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
              placeholder="Ex: Operador de Empilhadeira"
            />
          </FormField>
          <FormField label="Departamento" className="min-w-[12rem] flex-1">
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
          <FormField label="Gestor Responsável" className="min-w-[12rem] flex-1">
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
          <FormField label="Vínculo" size="md">
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
          <FormField label="Regime de Trabalho" className="min-w-[12rem] flex-1">
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
          <FormField label="Jornada Semanal (h)" size="sm">
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
          <FormField label="Turno" size="md">
            <select
              value={formData.turno}
              onChange={(e) => setFormData({ ...formData, turno: e.target.value })}
              className={SELECT_CLASS}
            >
              <option value="">Selecione o turno</option>
              {turnos.map((t) => (
                <option key={t.id || t.codigo} value={t.codigo || t.id}>
                  {t.nome} ({t.horaInicio} – {t.horaFim})
                </option>
              ))}
            </select>
            {turnos.length === 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Nenhum turno cadastrado. Defina em{" "}
                <Link href="/rh/jornada/turnos" className="text-[var(--accent)] hover:underline">
                  RH → Turnos
                </Link>
                .
              </p>
            ) : null}
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Acesso à intranet" icon={KeyRound}>
        <p className="mb-4 text-sm text-muted-foreground">
          O RH define o perfil e a senha. O colaborador entra em /login/staff com o CPF.
        </p>
        <div className="flex flex-wrap gap-4">
          <FormField label="Perfil" required className="min-w-[14rem] flex-1">
            <select
              value={formData.perfilIntranet}
              onChange={(e) => setFormData({ ...formData, perfilIntranet: e.target.value })}
              className={SELECT_CLASS}
            >
              <option value="">Selecione...</option>
              {COLABORADOR_INTRANET_PERFIS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label={colaboradorId ? "Nova senha" : "Senha"} required={!colaboradorId} className="min-w-[14rem] flex-1">
            <Input
              type="password"
              autoComplete="new-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder={colaboradorId ? "Deixe em branco para manter" : "Senha de acesso"}
            />
          </FormField>
          <FormField
            label="Confirmar senha"
            required={!colaboradorId || Boolean(senha)}
            className="min-w-[14rem] flex-1"
          >
            <Input
              type="password"
              autoComplete="new-password"
              value={senhaConfirmacao}
              onChange={(e) => setSenhaConfirmacao(e.target.value)}
              placeholder="Repita a senha"
            />
          </FormField>
        </div>
        {senha ? <PasswordStrengthPanel password={senha} className="mt-4" /> : null}
      </FormSection>

      <FormSection title="Dados Financeiros" icon={Wallet}>
        <div className="flex flex-wrap gap-4">
          <FormField label="Centro de Custo" className="min-w-[14rem] flex-1">
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
          <FormField label="Salário base" size="md">
            <MoneyInput
              value={formData.salario}
              onChange={(v) => setFormData({ ...formData, salario: v })}
            />
          </FormField>
          <FormField label="Conta Bancária" className="min-w-[14rem] flex-1">
            <Input
              value={formData.contaBancaria}
              onChange={(e) => setFormData({ ...formData, contaBancaria: e.target.value })}
              placeholder="Banco / Agência / Conta"
            />
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Carteira Nacional de Habilitação (CNH)" icon={FileText}>
        <div className="flex flex-wrap gap-4">
          <FormField label="Número da CNH" size="md">
            <Input
              value={formData.cnhNumero}
              onChange={(e) => setFormData({ ...formData, cnhNumero: e.target.value })}
              className="tabular-nums"
            />
          </FormField>
          <FormField label="Categoria" size="sm">
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
          <FormField label="Validade" size="md">
            <Input
              type="date"
              value={formData.cnhValidade}
              onChange={(e) => setFormData({ ...formData, cnhValidade: e.target.value })}
            />
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Status e Observações" icon={Calendar}>
        <div className="mb-4 flex flex-wrap gap-4">
          <FormField label="Status" className="min-w-[14rem] flex-1">
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
              <FormField label="Data de Demissão" size="md">
                <Input
                  type="date"
                  value={formData.dataDemissao}
                  onChange={(e) => setFormData({ ...formData, dataDemissao: e.target.value })}
                />
              </FormField>
              <FormField label="Motivo da Demissão" className="min-w-[16rem] flex-[2]">
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

      <FamiliaresSection
        familiares={familiares}
        onAdd={addFamiliar}
        onChange={updateFamiliar}
        onRemove={removeFamiliar}
      />

      <div className="flex justify-end gap-2">
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
