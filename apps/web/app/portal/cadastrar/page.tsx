"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useCepLookup, CEP_SUBMIT_WARNING } from "@/hooks/use-cep-lookup";
import { useCnpjLookup } from "@/hooks/use-cnpj-lookup";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  ApiError,
  getApiBase,
  tryPortalClienteRegister,
  resolvePortalRegisterErrorMessage,
  type PortalClienteRegisterPayload,
} from "@/lib/api/portal-client";
import { formatCpfBr, formatCpfCnpjBr } from "@/lib/format-cpf-cnpj-br";
import {
  BR_UF,
  formatCepBr,
  formatIbge7,
  formatPhoneBr,
} from "@/lib/nfse/cliente-fiscal";
import { evaluatePassword } from "@/lib/security/password-validator";
import { toast } from "@/lib/toast";
import { PasswordStrengthPanel } from "@/components/portal/password-strength-panel";
import { TermosAceiteCheckbox, TermosAceitePanel } from "@/components/portal/termos-aceite-panel";
import {
  compareDominioCorporativoUi,
  DOMINIO_VALIDACAO_MESSAGES,
} from "@/lib/portal-dominio-validacao";
import { RlLogo } from "@/components/portal/rl-logo";
import { Switch } from "@/components/ui/switch";
import { validateCnpjDigits, validateCpfDigits } from "@/lib/br-documents";
import {
  readAutoPreencherCnpjPreference,
  writeAutoPreencherCnpjPreference,
} from "@/lib/portal-cnpj-autofill";
import { DEFAULT_PERMISSOES, type PermissoesPessoa } from "@/stores/pessoaPermissoesStore";

type TipoAutorizacao = "PF" | "PJ";

type AutorizacaoCadastroDraft = {
  tipoAutorizacao: TipoAutorizacao;
  nome: string;
  documento: string;
  email: string;
  telefone: string;
  permissoes: PermissoesPessoa;
};

const PERM_LABELS: Array<{ key: keyof PermissoesPessoa; label: string }> = [
  { key: "podeCriarSolicitacao", label: "Pode criar solicitações" },
  { key: "podeAnexarDocumentos", label: "Pode anexar documentos" },
  { key: "podeAgendarTurno", label: "Pode agendar turno" },
  { key: "podeVisualizarFinanceiro", label: "Pode visualizar financeiro" },
  { key: "podeAprovarOS", label: "Pode aprovar OS" },
  { key: "podeAlterarDadosGate", label: "Pode alterar dados no gate" },
  { key: "podeGerarPDF", label: "Pode gerar PDF" },
  { key: "podeGerenciarPessoas", label: "Pode gerenciar pessoas" },
];

/** Primeira pessoa do cadastro PJ: administrador com todas as permissões operacionais. */
const ADMIN_PERMISSOES: PermissoesPessoa = {
  podeCriarSolicitacao: true,
  podeAnexarDocumentos: true,
  podeAgendarTurno: true,
  podeVisualizarFinanceiro: true,
  podeAprovarOS: true,
  podeVerOS: true,
  podeAlterarDadosGate: true,
  podeGerarPDF: true,
  podeGerenciarPessoas: true,
};

function emptyAutorizacaoDraft(admin = false): AutorizacaoCadastroDraft {
  return {
    tipoAutorizacao: "PF",
    nome: "",
    documento: "",
    email: "",
    telefone: "",
    permissoes: admin ? { ...ADMIN_PERMISSOES } : { ...DEFAULT_PERMISSOES },
  };
}

function isAutorizacaoPfCompleta(p: AutorizacaoCadastroDraft): boolean {
  const doc = p.documento.replace(/\D/g, "");
  return (
    p.tipoAutorizacao === "PF" &&
    Boolean(p.nome.trim()) &&
    Boolean(p.email.trim()) &&
    doc.length === 11 &&
    validateCpfDigits(doc) &&
    /^\d{10,11}$/.test(p.telefone.replace(/\D/g, ""))
  );
}

function isAutorizacaoPjCompleta(p: AutorizacaoCadastroDraft): boolean {
  const doc = p.documento.replace(/\D/g, "");
  return (
    p.tipoAutorizacao === "PJ" &&
    Boolean(p.nome.trim()) &&
    Boolean(p.email.trim()) &&
    doc.length === 14 &&
    validateCnpjDigits(doc) &&
    /^\d{10,11}$/.test(p.telefone.replace(/\D/g, ""))
  );
}

/** Borda laranja em campos de preenchimento obrigatório (cadastro PF / PJ). */
const REQUIRED_FIELD_CLASS =
  "border-orange-500 focus-visible:border-orange-400 focus-visible:ring-orange-500/50";
const REQUIRED_SELECT_CLASS =
  "border-orange-500 bg-zinc-950 text-zinc-100 focus-visible:ring-2 focus-visible:ring-orange-500/50 rounded-md";

const PAGE_MAX_W = "max-w-[1100px] w-full mx-auto px-4";
/** Grid único do formulário — gap vertical compacto (gap-y-2). */
const FORM = "grid grid-cols-12 gap-x-4 gap-y-2";
/** Linha interna: ocupa 12 colunas do pai e reparte campos em 12. */
const FORM_ROW = "col-span-12 grid grid-cols-12 gap-x-4";
/** Linha interna com gap vertical compacto (autorizações). */
const FORM_ROW_INNER = "col-span-12 grid grid-cols-12 gap-x-4 gap-y-2";
const FIELD = "min-w-0";
const FIELD_LABEL = "block min-h-[1.25rem] text-sm font-medium leading-tight text-slate-300";
/** Reserva altura uniforme para hints abaixo do input (alinha linhas do grid). */
const FIELD_BELOW = "min-h-[1.25rem] text-xs leading-snug";

function SectionTitle({
  children,
  hint,
  first,
}: {
  children: React.ReactNode;
  hint?: string;
  first?: boolean;
}) {
  return (
    <h3
      className={cn(
        "col-span-12 text-base font-semibold text-slate-100",
        first ? "mb-1" : "mt-3 mb-1",
      )}
    >
      <span className="inline-flex flex-wrap items-center gap-2">
        {children}
        {hint ? (
          <span
            className="cursor-help text-sm font-normal text-slate-500"
            title={hint}
            role="note"
          >
            (?)
          </span>
        ) : null}
      </span>
    </h3>
  );
}

/** Máscara BR em tempo real: 47996581200 → (47) 99658-1200 (inclui colar/autofill). */
function phoneFieldProps(value: string, setFormatted: (next: string) => void) {
  const apply = (raw: string) => setFormatted(formatPhoneBr(raw));
  return {
    value,
    inputMode: "tel" as const,
    autoComplete: "tel" as const,
    maxLength: 15,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => apply(e.target.value),
    onBlur: () => {
      if (value.replace(/\D/g, "").length >= 10) apply(value);
    },
    onPaste: (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      apply(e.clipboardData.getData("text"));
    },
  };
}

export default function PortalCadastrarPage() {
  const router = useRouter();
  const [tipo, setTipo] = useState<"PF" | "PJ">("PJ");
  const [nomeCompleto, setNomeCompleto] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [inscricaoMunicipal, setInscricaoMunicipal] = useState("");
  const [inscricaoEstadual, setInscricaoEstadual] = useState("");
  const [isentoIE, setIsentoIE] = useState(false);
  const [email, setEmail] = useState("");
  const [emailNfse, setEmailNfse] = useState("");
  const [telefone, setTelefone] = useState("");
  const [telefoneContato, setTelefoneContato] = useState("");
  const [enderecoLogradouro, setEnderecoLogradouro] = useState("");
  const [enderecoNumero, setEnderecoNumero] = useState("");
  const [enderecoComplemento, setEnderecoComplemento] = useState("");
  const [enderecoBairro, setEnderecoBairro] = useState("");
  const [enderecoCidade, setEnderecoCidade] = useState("");
  const [enderecoUf, setEnderecoUf] = useState("SC");
  const [enderecoCep, setEnderecoCep] = useState("");
  const [codigoMunicipioIbge, setCodigoMunicipioIbge] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [autorizacoes, setAutorizacoes] = useState<AutorizacaoCadastroDraft[]>([
    emptyAutorizacaoDraft(true),
  ]);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [aceiteTermos, setAceiteTermos] = useState(false);
  const [termosAceiteEnabled, setTermosAceiteEnabled] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [autoPreencherCnpj, setAutoPreencherCnpj] = useState(true);
  const [autofillCnpjHydrated, setAutofillCnpjHydrated] = useState(false);

  useEffect(() => {
    setAutoPreencherCnpj(readAutoPreencherCnpjPreference());
    setAutofillCnpjHydrated(true);
  }, []);

  useEffect(() => {
    if (!autofillCnpjHydrated) return;
    writeAutoPreencherCnpjPreference(autoPreencherCnpj);
  }, [autoPreencherCnpj, autofillCnpjHydrated]);

  const { loading: cepLoading, cepHint, data: cepLookupData, cepValido, cepDigits } =
    useCepLookup(enderecoCep);

  const { loading: cnpjLoading, data: cnpjLookupData } = useCnpjLookup(cpfCnpj, {
    enabled: tipo === "PJ" && autoPreencherCnpj,
  });

  const cnpjLookupActive = autoPreencherCnpj && cnpjLoading;

  useEffect(() => {
    if (!cepLookupData) return;
    if (cepLookupData.logradouro) setEnderecoLogradouro(cepLookupData.logradouro);
    if (cepLookupData.bairro) setEnderecoBairro(cepLookupData.bairro);
    if (cepLookupData.cidade) setEnderecoCidade(cepLookupData.cidade);
    if (cepLookupData.uf) setEnderecoUf(cepLookupData.uf.toUpperCase());
    if (cepLookupData.ibge) setCodigoMunicipioIbge(formatIbge7(cepLookupData.ibge));
    setEnderecoCep(formatCepBr(cepLookupData.cep));
  }, [cepLookupData]);

  useEffect(() => {
    if (tipo !== "PJ" || !cnpjLookupData) return;
    setRazaoSocial(cnpjLookupData.razaoSocial);
    setNomeFantasia(cnpjLookupData.nomeFantasia);
    if (cnpjLookupData.cep) setEnderecoCep(formatCepBr(cnpjLookupData.cep));
    if (cnpjLookupData.logradouro) setEnderecoLogradouro(cnpjLookupData.logradouro);
    if (cnpjLookupData.numero) setEnderecoNumero(cnpjLookupData.numero);
    if (cnpjLookupData.complemento) setEnderecoComplemento(cnpjLookupData.complemento);
    if (cnpjLookupData.bairro) setEnderecoBairro(cnpjLookupData.bairro);
    if (cnpjLookupData.municipio) setEnderecoCidade(cnpjLookupData.municipio);
    if (cnpjLookupData.uf) setEnderecoUf(cnpjLookupData.uf.toUpperCase());
    if (cnpjLookupData.codigoMunicipioIbge) {
      setCodigoMunicipioIbge(formatIbge7(cnpjLookupData.codigoMunicipioIbge));
    }
  }, [cnpjLookupData, tipo]);

  const municipioLocked = Boolean(cepValido && cepDigits.length === 8);

  const docDigits = cpfCnpj.replace(/\D/g, "");
  const tipoDocOk = useMemo(() => {
    if (tipo === "PF") return docDigits.length === 11 && validateCpfDigits(docDigits);
    return docDigits.length === 14 && validateCnpjDigits(docDigits);
  }, [docDigits, tipo]);

  const validacaoDominioUi = useMemo(() => {
    if (tipo !== "PJ" || docDigits.length !== 14) return null;
    if (!cnpjLookupData && !email.trim()) return null;
    return compareDominioCorporativoUi(email, cnpjLookupData?.emailReceita);
  }, [tipo, docDigits.length, email, cnpjLookupData]);

  useEffect(() => {
    if (tipo !== "PF") return;
    setEmailNfse((prev) => (prev.trim() ? prev : email.trim()));
  }, [email, tipo]);

  function validateLocal(): string | null {
    if (password !== confirm) return "As senhas não coincidem.";
    if (!evaluatePassword(password).valid) return "A senha não atende aos requisitos mínimos de segurança.";
    if (!aceiteTermos) return "É necessário aceitar os Termos de Uso e Condições Gerais.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "E-mail inválido.";
    const tel = telefone.replace(/\D/g, "");
    if (!/^\d{10,11}$/.test(tel)) return "Telefone inválido (DDD + número, 10 ou 11 dígitos).";
    const cep = enderecoCep.replace(/\D/g, "");
    if (!/^\d{8}$/.test(cep)) return "CEP deve ter 8 dígitos.";
    if (!BR_UF.includes(enderecoUf.toUpperCase() as (typeof BR_UF)[number])) return "UF inválida.";
    if (!enderecoLogradouro.trim()) return "Logradouro é obrigatório.";
    if (!enderecoNumero.trim()) return "Número é obrigatório.";
    if (!enderecoBairro.trim()) return "Bairro é obrigatório.";
    if (!enderecoCidade.trim()) return "Cidade é obrigatória.";
    const ibge = codigoMunicipioIbge.replace(/\D/g, "");
    if (ibge && !/^\d{7}$/.test(ibge)) return "Código IBGE do município deve ter 7 dígitos.";

    if (tipo === "PF") {
      if (!nomeCompleto.trim()) return "Nome completo é obrigatório.";
      if (dataNascimento.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(dataNascimento.trim())) {
        return "Data de nascimento inválida.";
      }
      if (docDigits.length !== 11) return "Informe um CPF válido (11 dígitos).";
      if (!validateCpfDigits(docDigits)) return "CPF inválido (dígitos verificadores).";
      if (!tipoDocOk) return "CPF inválido para Pessoa Física.";
      const tc = telefoneContato.replace(/\D/g, "");
      if (telefoneContato.trim() && !/^\d{10,11}$/.test(tc)) return "Telefone de contato inválido.";
      const nf = (emailNfse.trim() || email.trim());
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nf)) return "E-mail NFS-e inválido.";
      return null;
    }

    if (docDigits.length !== 14) return "Informe um CNPJ válido (14 dígitos).";
    if (!validateCnpjDigits(docDigits)) return "CNPJ inválido (dígitos verificadores).";
    if (!tipoDocOk) return "O documento deve ser um CNPJ para Pessoa Jurídica.";
    if (!razaoSocial.trim()) return "Razão social é obrigatória.";
    if (!nomeFantasia.trim()) return "Nome fantasia é obrigatório para PJ.";
    if (!isentoIE && !inscricaoEstadual.trim()) {
      return "Inscrição estadual é obrigatória ou marque Isento de IE.";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNfse.trim())) return "E-mail NFS-e inválido.";
    if (!responsavel.trim()) return "Nome do responsável é obrigatório.";
    const rt = telefone.replace(/\D/g, "");
    if (!/^\d{10,11}$/.test(rt)) return "Telefone do responsável inválido.";
    const { pessoas, transportadoras } = autorizacoesPayload();
    if (pessoas.length === 0) {
      return "Cadastre ao menos uma pessoa física (CPF) autorizada com nome, CPF, e-mail e telefone válidos.";
    }
    if (!isAutorizacaoPfCompleta(autorizacoes[0]!)) {
      return "O administrador deve ser uma pessoa física (CPF) com dados completos.";
    }
    for (const row of autorizacoes) {
      const parcial =
        row.nome.trim() ||
        row.documento.replace(/\D/g, "") ||
        row.email.trim() ||
        row.telefone.replace(/\D/g, "");
      if (!parcial) continue;
      if (row.tipoAutorizacao === "PF" && !isAutorizacaoPfCompleta(row)) {
        return "Preencha nome, CPF, e-mail e telefone válidos em cada autorização de pessoa física.";
      }
      if (row.tipoAutorizacao === "PJ" && !isAutorizacaoPjCompleta(row)) {
        return "Preencha razão social, CNPJ, e-mail e telefone válidos em cada transportadora autorizada.";
      }
    }
    if (transportadoras.length > 0 && pessoas.length === 0) {
      return "É necessário ao menos uma pessoa física (CPF) além das transportadoras.";
    }
    return null;
  }

  function autorizacoesPayload() {
    const pessoas: Array<{
      nome: string;
      email: string;
      cpf: string;
      telefone: string;
      permissoes: PermissoesPessoa;
    }> = [];
    const transportadoras: Array<{
      cnpj: string;
      razaoSocial: string;
      emailContato: string;
    }> = [];

    for (const row of autorizacoes) {
      if (isAutorizacaoPfCompleta(row)) {
        pessoas.push({
          nome: row.nome.trim(),
          email: row.email.trim().toLowerCase(),
          cpf: row.documento.replace(/\D/g, ""),
          telefone: row.telefone.replace(/\D/g, ""),
          permissoes: row.permissoes,
        });
      } else if (isAutorizacaoPjCompleta(row)) {
        transportadoras.push({
          razaoSocial: row.nome.trim(),
          cnpj: row.documento.replace(/\D/g, ""),
          emailContato: row.email.trim().toLowerCase(),
        });
      }
    }
    return { pessoas, transportadoras };
  }

  function addAutorizacaoRow() {
    setAutorizacoes((prev) => [...prev, emptyAutorizacaoDraft()]);
  }

  function removeAutorizacaoRow(index: number) {
    setAutorizacoes((prev) => prev.filter((_, i) => i !== index));
  }

  function updateAutorizacaoRow(
    index: number,
    field: "nome" | "email" | "documento" | "telefone",
    value: string,
  ) {
    setAutorizacoes((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
  }

  function setTipoAutorizacao(index: number, tipoAutorizacao: TipoAutorizacao) {
    if (index === 0 && tipoAutorizacao === "PJ") return;
    setAutorizacoes((prev) =>
      prev.map((row, i) =>
        i === index ? { ...row, tipoAutorizacao, documento: "" } : row,
      ),
    );
  }

  function togglePermissao(index: number, key: keyof PermissoesPessoa) {
    setAutorizacoes((prev) =>
      prev.map((row, i) =>
        i === index
          ? { ...row, permissoes: { ...row.permissoes, [key]: !row.permissoes[key] } }
          : row,
      ),
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const local = validateLocal();
    if (local) {
      setErr(local);
      toast.error(local);
      return;
    }

    let payload: PortalClienteRegisterPayload;
    const docDigitsNormalized = cpfCnpj.replace(/\D/g, "");
    if (tipo === "PF") {
      const telCont = telefoneContato.replace(/\D/g, "");
      payload = {
        nomeCompleto: nomeCompleto.trim(),
        tipo: "PF",
        cpfCnpj: docDigitsNormalized,
        ...(dataNascimento.trim() ? { dataNascimento: dataNascimento.trim() } : {}),
        email: email.trim(),
        telefone: telefone.replace(/\D/g, ""),
        emailNfse: (emailNfse.trim() || email.trim()).toLowerCase(),
        telefoneContato: telCont || undefined,
        enderecoLogradouro: enderecoLogradouro.trim(),
        enderecoNumero: enderecoNumero.trim(),
        enderecoComplemento: enderecoComplemento.trim() || undefined,
        enderecoBairro: enderecoBairro.trim(),
        enderecoCidade: enderecoCidade.trim(),
        enderecoUf: enderecoUf.trim().toUpperCase(),
        enderecoCep: enderecoCep.replace(/\D/g, ""),
        ...(codigoMunicipioIbge.replace(/\D/g, "")
          ? { codigoMunicipioIbge: codigoMunicipioIbge.replace(/\D/g, "") }
          : {}),
        password,
        aceiteTermos: true,
      };
    } else {
      const { pessoas, transportadoras } = autorizacoesPayload();
      payload = {
        razaoSocial: razaoSocial.trim(),
        nomeFantasia: nomeFantasia.trim(),
        tipo: "PJ",
        cpfCnpj: docDigitsNormalized,
        inscricaoMunicipal: inscricaoMunicipal.replace(/\D/g, "") || undefined,
        inscricaoEstadual: inscricaoEstadual.replace(/\D/g, "") || undefined,
        isentoIE,
        email: email.trim(),
        emailNfse: emailNfse.trim(),
        telefone: telefone.replace(/\D/g, ""),
        enderecoLogradouro: enderecoLogradouro.trim(),
        enderecoNumero: enderecoNumero.trim(),
        enderecoComplemento: enderecoComplemento.trim() || undefined,
        enderecoBairro: enderecoBairro.trim(),
        enderecoCidade: enderecoCidade.trim(),
        enderecoUf: enderecoUf.trim().toUpperCase(),
        enderecoCep: enderecoCep.replace(/\D/g, ""),
        ...(codigoMunicipioIbge.replace(/\D/g, "")
          ? { codigoMunicipioIbge: codigoMunicipioIbge.replace(/\D/g, "") }
          : {}),
        responsavel: responsavel.trim(),
        responsavelTelefone: telefone.replace(/\D/g, ""),
        responsavelEmail: emailNfse.trim().toLowerCase(),
        password,
        ...(pessoas.length ? { pessoasAutorizadas: pessoas } : {}),
        ...(transportadoras.length ? { transportadorasAutorizadas: transportadoras } : {}),
        aceiteTermos: true,
      };
    }

    setSubmitting(true);
    try {
      if (cepDigits.length === 8 && !cepValido) {
        toast.message(CEP_SUBMIT_WARNING);
      }
      await tryPortalClienteRegister(payload);
      toast.success("Cadastro realizado com sucesso. Faça login para continuar.");
      router.replace("/portal/login");
    } catch (e) {
      const raw = e instanceof ApiError ? e.message : "Erro ao cadastrar";
      const msg = resolvePortalRegisterErrorMessage(raw);
      setErr(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const nfsePfHint = "Para emissão de NFS-e como Pessoa Física, utilizamos seu CPF e endereço residencial.";

  return (
    <div className="flex min-h-screen flex-col items-center bg-[#080a0d] px-4 py-4">
      <div className={cn("mb-3 flex items-center gap-3", PAGE_MAX_W)}>
        <RlLogo className="h-10 w-10 text-lg" />
        <div>
          <h1 className="text-xl font-bold text-white">Criar conta</h1>
          <p className="text-sm text-slate-500">Portal do cliente</p>
        </div>
      </div>

      <Card className={cn(PAGE_MAX_W, "border-white/10")}>
        <CardHeader className="pb-2 pt-4">
          <CardTitle>Cadastro</CardTitle>
          <CardDescription>
            {tipo === "PF"
              ? "Pessoa física: dados para NFS-e e acesso ao portal."
              : "Informe os dados da empresa para emissão de NFS-e e acesso ao portal."}
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-4 pt-0">
          <form onSubmit={(e) => void onSubmit(e)} className={FORM}>
            <SectionTitle first>Tipo de cadastro</SectionTitle>
            <div className={FORM_ROW}>
              <div className="col-span-12 flex justify-center">
                <div
                  className="inline-flex rounded-md border border-white/15 p-0.5"
                  role="group"
                  aria-label="Tipo de cadastro"
                >
                  <button
                    type="button"
                    className={cn(
                      "rounded px-4 py-1.5 text-xs font-medium transition-colors",
                      tipo === "PJ"
                        ? "border border-[var(--accent)] bg-[var(--accent)]/15 text-white"
                        : "border border-transparent text-slate-400 hover:text-slate-200",
                    )}
                    onClick={() => {
                      setTipo("PJ");
                      setCpfCnpj("");
                    }}
                  >
                    Pessoa jurídica (CNPJ)
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "rounded px-4 py-1.5 text-xs font-medium transition-colors",
                      tipo === "PF"
                        ? "border border-[var(--accent)] bg-[var(--accent)]/15 text-white"
                        : "border border-transparent text-slate-400 hover:text-slate-200",
                    )}
                    onClick={() => {
                      setTipo("PF");
                      setCpfCnpj("");
                      setEmailNfse((prev) => prev.trim() || email.trim());
                    }}
                  >
                    Pessoa física (CPF)
                  </button>
                </div>
              </div>
            </div>

            {tipo === "PF" ? (
              <>
                <SectionTitle hint={nfsePfHint}>Dados do cliente</SectionTitle>
                <div className={FORM_ROW}>
                  <div className={cn(FIELD, "col-span-12")}>
                    <label className={FIELD_LABEL}>Nome completo</label>
                    <Input
                      className={REQUIRED_FIELD_CLASS}
                      value={nomeCompleto}
                      onChange={(e) => setNomeCompleto(e.target.value)}
                      required
                      autoComplete="name"
                    />
                    <div className={FIELD_BELOW} aria-hidden />
                  </div>
                </div>
                <div className={FORM_ROW}>
                  <div className={cn(FIELD, "col-span-12 md:col-span-6")}>
                    <label className={FIELD_LABEL}>CPF</label>
                    <Input
                      className={REQUIRED_FIELD_CLASS}
                      inputMode="numeric"
                      value={cpfCnpj}
                      onChange={(e) => setCpfCnpj(formatCpfBr(e.target.value))}
                      required
                      autoComplete="off"
                    />
                    <div className={FIELD_BELOW}>
                      {!tipoDocOk && docDigits.length >= 11 ? (
                        <p className="text-amber-400">Use apenas CPF (11 dígitos) para Pessoa Física.</p>
                      ) : null}
                    </div>
                  </div>
                  <div className={cn(FIELD, "col-span-12 md:col-span-6")}>
                    <label className={FIELD_LABEL}>
                      Data de nascimento <span className="font-normal text-slate-500">(opcional)</span>
                    </label>
                    <Input
                      type="date"
                      value={dataNascimento}
                      onChange={(e) => setDataNascimento(e.target.value)}
                    />
                    <div className={FIELD_BELOW} aria-hidden />
                  </div>
                </div>
                <div className={FORM_ROW}>
                  <div className={cn(FIELD, "col-span-12 md:col-span-6")}>
                    <label className={FIELD_LABEL}>E-mail (login)</label>
                    <Input
                      className={REQUIRED_FIELD_CLASS}
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                    />
                    <div className={FIELD_BELOW} aria-hidden />
                  </div>
                  <div className={cn(FIELD, "col-span-12 md:col-span-6")}>
                    <label className={FIELD_LABEL}>Telefone</label>
                    <Input
                      className={REQUIRED_FIELD_CLASS}
                      required
                      {...phoneFieldProps(telefone, setTelefone)}
                    />
                    <div className={FIELD_BELOW} aria-hidden />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="col-span-12 mt-3 mb-1 grid grid-cols-12 items-end gap-x-4">
                  <h3 className="col-span-12 text-base font-semibold text-slate-100 md:col-span-8">
                    Dados fiscais da empresa
                  </h3>
                  <label className="col-span-12 flex cursor-pointer items-center justify-end gap-2.5 md:col-span-4">
                    <span className="text-xs font-medium leading-tight text-slate-300">
                      Buscar dados na Receita Federal
                    </span>
                    <Switch
                      checked={autoPreencherCnpj}
                      onCheckedChange={setAutoPreencherCnpj}
                      aria-label="Buscar dados na Receita Federal"
                    />
                  </label>
                </div>
                <div className={FORM_ROW}>
                  <div className={cn(FIELD, "col-span-12 md:col-span-3")}>
                    <label className={cn(FIELD_LABEL, "flex items-end gap-2")}>
                      CNPJ
                      {cnpjLookupActive ? (
                        <Loader2 className="mb-0.5 h-4 w-4 shrink-0 animate-spin text-slate-400" aria-hidden />
                      ) : null}
                    </label>
                    <Input
                      className={REQUIRED_FIELD_CLASS}
                      inputMode="numeric"
                      value={cpfCnpj}
                      onChange={(e) => setCpfCnpj(formatCpfCnpjBr(e.target.value))}
                      required
                      autoComplete="off"
                    />
                    <div className={FIELD_BELOW}>
                      {cnpjLookupActive ? (
                        <p className="text-slate-400" role="status">
                          Buscando dados na Receita Federal...
                        </p>
                      ) : !tipoDocOk && docDigits.length >= 14 ? (
                        <p className="text-amber-400">Use CNPJ (14 dígitos) para Pessoa Jurídica.</p>
                      ) : null}
                    </div>
                  </div>
                  <div className={cn(FIELD, "col-span-12 md:col-span-9")}>
                    <label className={FIELD_LABEL}>Razão social</label>
                    <Input
                      className={REQUIRED_FIELD_CLASS}
                      value={razaoSocial}
                      onChange={(e) => setRazaoSocial(e.target.value)}
                      disabled={cnpjLookupActive}
                      required
                      autoComplete="organization"
                    />
                    <div className={FIELD_BELOW} aria-hidden />
                  </div>
                </div>
                <div className={FORM_ROW}>
                  <div className={cn(FIELD, "col-span-12 md:col-span-4")}>
                    <label className={FIELD_LABEL}>Nome fantasia</label>
                    <Input
                      className={REQUIRED_FIELD_CLASS}
                      value={nomeFantasia}
                      onChange={(e) => setNomeFantasia(e.target.value)}
                      disabled={cnpjLookupActive}
                      required
                    />
                    <div className={FIELD_BELOW} aria-hidden />
                  </div>
                  <div className={cn(FIELD, "col-span-12 md:col-span-4")}>
                    <label className={FIELD_LABEL}>Inscrição estadual</label>
                    <Input
                      value={inscricaoEstadual}
                      onChange={(e) => setInscricaoEstadual(e.target.value)}
                      disabled={isentoIE}
                      required={!isentoIE}
                      className={!isentoIE ? REQUIRED_FIELD_CLASS : undefined}
                    />
                    <label
                      htmlFor="ie-exento"
                      className="mt-0 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground"
                    >
                      <input
                        id="ie-exento"
                        type="checkbox"
                        checked={isentoIE}
                        onChange={(e) => setIsentoIE(e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-white/20 bg-transparent"
                      />
                      Isento de IE
                    </label>
                    <div className={FIELD_BELOW} aria-hidden />
                  </div>
                  <div className={cn(FIELD, "col-span-12 md:col-span-4")}>
                    <label className={FIELD_LABEL}>Inscrição municipal</label>
                    <Input value={inscricaoMunicipal} onChange={(e) => setInscricaoMunicipal(e.target.value)} />
                    <div className={FIELD_BELOW} aria-hidden />
                  </div>
                </div>
                <div className={FORM_ROW}>
                  <div className={cn(FIELD, "col-span-12 md:col-span-6")}>
                    <label className={FIELD_LABEL}>E-mail</label>
                    <Input
                      className={REQUIRED_FIELD_CLASS}
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                    />
                    <div className={FIELD_BELOW}>
                      {validacaoDominioUi ? (
                        <p
                          className={cn(
                            "leading-snug",
                            DOMINIO_VALIDACAO_MESSAGES[validacaoDominioUi].className,
                          )}
                          role="status"
                        >
                          {DOMINIO_VALIDACAO_MESSAGES[validacaoDominioUi].icon}{" "}
                          {DOMINIO_VALIDACAO_MESSAGES[validacaoDominioUi].text}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className={cn(FIELD, "col-span-12 md:col-span-6")}>
                    <label className={FIELD_LABEL}>Telefone</label>
                    <Input
                      className={REQUIRED_FIELD_CLASS}
                      required
                      {...phoneFieldProps(telefone, setTelefone)}
                    />
                    <div className={FIELD_BELOW} aria-hidden />
                  </div>
                </div>
              </>
            )}

            {tipo === "PJ" ? (
              <h3 className="col-span-12 mt-3 mb-1 text-base font-semibold text-slate-100">
                Endereço fiscal
              </h3>
            ) : (
              <SectionTitle>Endereço</SectionTitle>
            )}

            <div className={FORM_ROW}>
              <div className={cn(FIELD, "col-span-12 md:col-span-2")}>
                <label className={cn(FIELD_LABEL, "gap-2")}>
                  CEP
                  {cepLoading ? (
                    <Loader2 className="mb-0.5 h-4 w-4 shrink-0 animate-spin text-slate-400" aria-hidden />
                  ) : null}
                </label>
                <Input
                  className={REQUIRED_FIELD_CLASS}
                  value={enderecoCep}
                  onChange={(e) => setEnderecoCep(formatCepBr(e.target.value))}
                  inputMode="numeric"
                  required
                  autoComplete="postal-code"
                />
                <div className={FIELD_BELOW}>
                  {cepHint ? (
                    <p className="text-amber-400/90" role="status">
                      {cepHint}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className={cn(FIELD, "col-span-12 md:col-span-7")}>
                <label className={FIELD_LABEL}>Logradouro</label>
                <Input
                  className={REQUIRED_FIELD_CLASS}
                  value={enderecoLogradouro}
                  onChange={(e) => setEnderecoLogradouro(e.target.value)}
                  required
                />
                <div className={FIELD_BELOW} aria-hidden />
              </div>
              <div className={cn(FIELD, "col-span-12 md:col-span-3")}>
                <label className={FIELD_LABEL}>Número</label>
                <Input
                  className={REQUIRED_FIELD_CLASS}
                  value={enderecoNumero}
                  onChange={(e) => setEnderecoNumero(e.target.value)}
                  required
                />
                <div className={FIELD_BELOW} aria-hidden />
              </div>
            </div>
            <div className={FORM_ROW}>
              <div className={cn(FIELD, "col-span-12 md:col-span-3")}>
                <label className={FIELD_LABEL}>Complemento</label>
                <Input value={enderecoComplemento} onChange={(e) => setEnderecoComplemento(e.target.value)} />
                <div className={FIELD_BELOW} aria-hidden />
              </div>
              <div className={cn(FIELD, "col-span-12 md:col-span-3")}>
                <label className={FIELD_LABEL}>Bairro</label>
                <Input
                  className={REQUIRED_FIELD_CLASS}
                  value={enderecoBairro}
                  onChange={(e) => setEnderecoBairro(e.target.value)}
                  required
                />
                <div className={FIELD_BELOW} aria-hidden />
              </div>
              <div className={cn(FIELD, "col-span-12 md:col-span-4")}>
                <label
                  className={cn(FIELD_LABEL, "gap-2")}
                  title={municipioLocked ? "Endereço encontrado automaticamente via CEP" : undefined}
                >
                  Cidade
                  {municipioLocked ? (
                    <span
                      className="cursor-help text-[11px] font-normal text-slate-500"
                      title="Endereço encontrado automaticamente via CEP"
                    >
                      (?)
                    </span>
                  ) : null}
                </label>
                <Input
                  value={enderecoCidade}
                  readOnly={municipioLocked}
                  onChange={(e) => setEnderecoCidade(e.target.value)}
                  required
                  className={cn(REQUIRED_FIELD_CLASS, municipioLocked && "cursor-not-allowed opacity-90")}
                />
                <div className={FIELD_BELOW} aria-hidden />
              </div>
              <div className={cn(FIELD, "col-span-12 md:col-span-2")}>
                <label className={FIELD_LABEL}>UF</label>
                <select
                  className={cn(
                    REQUIRED_SELECT_CLASS,
                    "h-10 w-full px-3",
                    municipioLocked && "cursor-not-allowed opacity-90",
                  )}
                  value={enderecoUf}
                  disabled={municipioLocked}
                  onChange={(e) => setEnderecoUf(e.target.value)}
                >
                  {BR_UF.map((uf) => (
                    <option key={uf} value={uf}>
                      {uf}
                    </option>
                  ))}
                </select>
                <div className={FIELD_BELOW} aria-hidden />
              </div>
            </div>
            <input
              type="hidden"
              name="codigoMunicipioIbge"
              value={codigoMunicipioIbge.replace(/\D/g, "")}
              readOnly
              aria-hidden
            />

            {tipo === "PJ" ? (
              <>
                <SectionTitle>Contato para NFS-e</SectionTitle>
                <div className={FORM_ROW}>
                  <div className={cn(FIELD, "col-span-12 md:col-span-4")}>
                    <label className={FIELD_LABEL}>E-mail NFS-e</label>
                    <Input
                      className={REQUIRED_FIELD_CLASS}
                      type="email"
                      value={emailNfse}
                      onChange={(e) => setEmailNfse(e.target.value)}
                      required
                    />
                    <div className={FIELD_BELOW} aria-hidden />
                  </div>
                  <div className={cn(FIELD, "col-span-12 md:col-span-4")}>
                    <label className={FIELD_LABEL}>Telefone NFS-e</label>
                    <Input
                      className={REQUIRED_FIELD_CLASS}
                      required
                      {...phoneFieldProps(telefone, setTelefone)}
                    />
                    <div className={FIELD_BELOW} aria-hidden />
                  </div>
                  <div className={cn(FIELD, "col-span-12 md:col-span-4")}>
                    <label className={FIELD_LABEL}>Contato</label>
                    <Input
                      className={REQUIRED_FIELD_CLASS}
                      value={responsavel}
                      onChange={(e) => setResponsavel(e.target.value)}
                      required
                    />
                    <div className={FIELD_BELOW} aria-hidden />
                  </div>
                </div>
              </>
            ) : null}

            {tipo === "PF" ? (
              <>
                <SectionTitle>Contato</SectionTitle>
                <div className={FORM_ROW}>
                  <div className={cn(FIELD, "col-span-12 md:col-span-6")}>
                    <label className={FIELD_LABEL}>E-mail NFS-e</label>
                    <Input
                      type="email"
                      value={emailNfse}
                      onChange={(e) => setEmailNfse(e.target.value)}
                      placeholder={email.trim() || "mesmo e-mail do login"}
                    />
                    <div className={FIELD_BELOW} aria-hidden />
                  </div>
                  <div className={cn(FIELD, "col-span-12 md:col-span-6")}>
                    <label className={FIELD_LABEL}>Telefone de contato</label>
                    <Input
                      placeholder="Opcional — usa o telefone principal se vazio"
                      {...phoneFieldProps(telefoneContato, setTelefoneContato)}
                    />
                    <div className={FIELD_BELOW} aria-hidden />
                  </div>
                </div>
              </>
            ) : null}

            {tipo === "PJ" ? (
              <>
                <div className="col-span-12 mt-3 mb-1 flex items-center justify-between gap-x-4">
                  <h3 className="text-base font-semibold text-slate-100">
                    <span className="inline-flex flex-wrap items-center gap-2">
                      Autorizações (Usuários e Transportadoras)
                      <span
                        className="cursor-help text-sm font-normal text-slate-500"
                        title="Pessoas físicas (despachantes/funcionários) e transportadoras terceiras (CNPJ) autorizadas a operar com o login corporativo."
                        role="note"
                      >
                        (?)
                      </span>
                    </span>
                  </h3>
                  <button
                    type="button"
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0 border-white/20")}
                    onClick={addAutorizacaoRow}
                  >
                    + Adicionar Autorização
                  </button>
                </div>
                <p className="col-span-12 text-xs text-slate-500">
                  Cadastre usuários (CPF) e transportadoras (CNPJ) que poderão atuar em seu nome após o
                  login corporativo.
                </p>
                {autorizacoes.map((autorizacao, index) => (
                  <div
                    key={index}
                    className="col-span-12 grid grid-cols-12 gap-x-4 gap-y-2 rounded-lg border border-white/10 bg-zinc-950/40 p-3"
                  >
                    <div className="col-span-12 flex items-center justify-between gap-x-4">
                      <span className="inline-flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                        Autorização {index + 1}
                        {index === 0 ? (
                          <span className="rounded-full border border-[var(--accent)]/40 bg-[var(--accent)]/15 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-orange-200">
                            Administrador
                          </span>
                        ) : null}
                      </span>
                      {autorizacoes.length > 1 ? (
                        <button
                          type="button"
                          className="text-xs text-red-400 hover:underline"
                          onClick={() => removeAutorizacaoRow(index)}
                        >
                          Remover
                        </button>
                      ) : null}
                    </div>
                    <div className="col-span-12 mb-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      <label className="flex cursor-pointer items-center gap-1.5 text-slate-300">
                        <input
                          type="radio"
                          name={`tipo-autorizacao-${index}`}
                          className="accent-orange-500"
                          checked={autorizacao.tipoAutorizacao === "PF"}
                          disabled={index === 0}
                          onChange={() => setTipoAutorizacao(index, "PF")}
                        />
                        Pessoa Física (CPF)
                      </label>
                      <label
                        className={cn(
                          "flex items-center gap-1.5 text-slate-300",
                          index === 0 ? "cursor-not-allowed opacity-50" : "cursor-pointer",
                        )}
                      >
                        <input
                          type="radio"
                          name={`tipo-autorizacao-${index}`}
                          className="accent-orange-500"
                          checked={autorizacao.tipoAutorizacao === "PJ"}
                          disabled={index === 0}
                          onChange={() => setTipoAutorizacao(index, "PJ")}
                        />
                        Transportadora (CNPJ)
                      </label>
                    </div>
                    <div className={FORM_ROW_INNER}>
                      {autorizacao.tipoAutorizacao === "PF" ? (
                        <>
                          <div className={cn(FIELD, "col-span-12 md:col-span-8")}>
                            <label className={FIELD_LABEL}>Nome Completo</label>
                            <Input
                              value={autorizacao.nome}
                              onChange={(e) => updateAutorizacaoRow(index, "nome", e.target.value)}
                              placeholder="Nome completo"
                            />
                            <div className={FIELD_BELOW} aria-hidden />
                          </div>
                          <div className={cn(FIELD, "col-span-12 md:col-span-4")}>
                            <label className={FIELD_LABEL}>CPF</label>
                            <Input
                              inputMode="numeric"
                              value={autorizacao.documento}
                              onChange={(e) =>
                                updateAutorizacaoRow(index, "documento", formatCpfBr(e.target.value))
                              }
                              placeholder="000.000.000-00"
                              required
                            />
                            <div className={FIELD_BELOW} aria-hidden />
                          </div>
                        </>
                      ) : (
                        <>
                          <div className={cn(FIELD, "col-span-12 md:col-span-8")}>
                            <label className={FIELD_LABEL}>Razão Social da Transportadora</label>
                            <Input
                              value={autorizacao.nome}
                              onChange={(e) => updateAutorizacaoRow(index, "nome", e.target.value)}
                              placeholder="Razão social"
                            />
                            <div className={FIELD_BELOW} aria-hidden />
                          </div>
                          <div className={cn(FIELD, "col-span-12 md:col-span-4")}>
                            <label className={FIELD_LABEL}>CNPJ</label>
                            <Input
                              inputMode="numeric"
                              value={autorizacao.documento}
                              onChange={(e) =>
                                updateAutorizacaoRow(
                                  index,
                                  "documento",
                                  formatCpfCnpjBr(e.target.value),
                                )
                              }
                              placeholder="00.000.000/0000-00"
                              required
                            />
                            <div className={FIELD_BELOW} aria-hidden />
                          </div>
                        </>
                      )}
                      <div className={cn(FIELD, "col-span-12 md:col-span-6")}>
                        <label className={FIELD_LABEL}>E-mail</label>
                        <Input
                          type="email"
                          value={autorizacao.email}
                          onChange={(e) => updateAutorizacaoRow(index, "email", e.target.value)}
                          placeholder={
                            autorizacao.tipoAutorizacao === "PJ"
                              ? "operacao@transportadora.com.br"
                              : "email@empresa.com"
                          }
                        />
                        <div className={FIELD_BELOW} aria-hidden />
                      </div>
                      <div className={cn(FIELD, "col-span-12 md:col-span-6")}>
                        <label className={FIELD_LABEL}>Telefone / Celular</label>
                        <Input
                          placeholder="(00) 00000-0000"
                          {...phoneFieldProps(autorizacao.telefone, (v) =>
                            updateAutorizacaoRow(index, "telefone", v),
                          )}
                        />
                        <div className={FIELD_BELOW} aria-hidden />
                      </div>
                    </div>
                    <div className="col-span-12">
                      <p className={FIELD_LABEL}>Permissões operacionais</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        {PERM_LABELS.map(({ key, label }) => (
                          <label
                            key={key}
                            className="flex items-center gap-2 text-sm text-slate-300"
                          >
                            <input
                              type="checkbox"
                              checked={autorizacao.permissoes[key]}
                              onChange={() => togglePermissao(index, key)}
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </>
            ) : null}

            <SectionTitle>Acesso ao portal</SectionTitle>
            <div className={FORM_ROW}>
              <div className={cn(FIELD, "col-span-12 md:col-span-6")}>
                <label className={FIELD_LABEL}>Senha</label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  className={REQUIRED_FIELD_CLASS}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
                <div className={FIELD_BELOW} aria-hidden />
              </div>
              <div className={cn(FIELD, "col-span-12 md:col-span-6")}>
                <label className={FIELD_LABEL}>Confirmar senha</label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  className={REQUIRED_FIELD_CLASS}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={8}
                />
                <div className={FIELD_BELOW} aria-hidden />
              </div>
            </div>
            <div className="col-span-12 mx-auto max-w-md">
              <PasswordStrengthPanel password={password} />
            </div>

            <SectionTitle>Termos de Uso e Condições Gerais</SectionTitle>
            <TermosAceitePanel
              aceiteTermos={aceiteTermos}
              onAceiteChange={setAceiteTermos}
              hideCheckbox
              hideTitle
              embeddedInForm
              scrollClassName="max-h-24"
              onCheckboxEnabledChange={setTermosAceiteEnabled}
            />
            <TermosAceiteCheckbox
              aceiteTermos={aceiteTermos}
              onAceiteChange={setAceiteTermos}
              enabled={termosAceiteEnabled}
              className="col-span-12 flex items-start gap-2 text-sm"
            />

            {err ? (
              <p
                className="col-span-12 rounded-lg border border-red-500/40 bg-red-950/50 px-3 py-2 text-sm text-red-200"
                role="alert"
              >
                {err}
              </p>
            ) : null}
            <p className="col-span-12 text-[11px] text-slate-500">API: {getApiBase()}</p>
            <div className="col-span-12 mt-1 flex justify-end">
              <button
                type="submit"
                disabled={submitting || !aceiteTermos}
                className={cn(
                  buttonVariants({ variant: "default", size: "default" }),
                  "min-w-[180px]",
                )}
              >
                {submitting ? "Enviando…" : "Finalizar Cadastro"}
              </button>
            </div>
          </form>
          <p className="mt-4 text-center text-xs text-slate-500">
            <Link href="/portal/login" className="text-[var(--accent)] hover:underline">
              Voltar ao login
            </Link>
            {" · "}
            <Link href="/" className="text-[var(--accent)] hover:underline">
              Início
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
