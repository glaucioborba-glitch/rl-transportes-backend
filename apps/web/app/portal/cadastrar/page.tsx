"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useCepLookup, CEP_SUBMIT_WARNING } from "@/hooks/use-cep-lookup";
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
import { RlLogo } from "@/components/portal/rl-logo";
import { validateCnpjDigits, validateCpfDigits } from "@/lib/br-documents";
import { DEFAULT_PERMISSOES, type PermissoesPessoa } from "@/stores/pessoaPermissoesStore";

type PessoaCadastroDraft = {
  nome: string;
  email: string;
  cpf: string;
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

function emptyPessoaDraft(admin = false): PessoaCadastroDraft {
  return {
    nome: "",
    email: "",
    cpf: "",
    telefone: "",
    permissoes: admin ? { ...ADMIN_PERMISSOES } : { ...DEFAULT_PERMISSOES },
  };
}

/** Borda laranja em campos de preenchimento obrigatório (cadastro PF / PJ). */
const REQUIRED_FIELD_CLASS =
  "border-orange-500 focus-visible:border-orange-400 focus-visible:ring-orange-500/50";
const REQUIRED_SELECT_CLASS =
  "border-orange-500 bg-zinc-950 text-zinc-100 focus-visible:ring-2 focus-visible:ring-orange-500/50 rounded-md";

function SectionTitle({
  children,
  hint,
}: {
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <h2 className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-2 text-sm font-semibold tracking-wide text-slate-200">
      <span>{children}</span>
      {hint ? (
        <span
          className="cursor-help text-[11px] font-normal text-slate-500"
          title={hint}
          role="note"
        >
          (?)
        </span>
      ) : null}
    </h2>
  );
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
  const [responsavelTelefone, setResponsavelTelefone] = useState("");
  const [pessoasAutorizadas, setPessoasAutorizadas] = useState<PessoaCadastroDraft[]>([
    emptyPessoaDraft(true),
  ]);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { loading: cepLoading, cepHint, data: cepLookupData, cepValido, cepDigits } =
    useCepLookup(enderecoCep);

  useEffect(() => {
    if (!cepLookupData) return;
    if (cepLookupData.logradouro) setEnderecoLogradouro(cepLookupData.logradouro);
    if (cepLookupData.bairro) setEnderecoBairro(cepLookupData.bairro);
    if (cepLookupData.cidade) setEnderecoCidade(cepLookupData.cidade);
    if (cepLookupData.uf) setEnderecoUf(cepLookupData.uf.toUpperCase());
    if (cepLookupData.ibge) setCodigoMunicipioIbge(formatIbge7(cepLookupData.ibge));
    setEnderecoCep(formatCepBr(cepLookupData.cep));
  }, [cepLookupData]);

  const municipioLocked = Boolean(cepValido && cepDigits.length === 8);

  const docDigits = cpfCnpj.replace(/\D/g, "");
  const tipoDocOk = useMemo(() => {
    if (tipo === "PF") return docDigits.length === 11 && validateCpfDigits(docDigits);
    return docDigits.length === 14 && validateCnpjDigits(docDigits);
  }, [docDigits, tipo]);

  useEffect(() => {
    if (tipo !== "PF") return;
    setEmailNfse((prev) => (prev.trim() ? prev : email.trim()));
  }, [email, tipo]);

  function validateLocal(): string | null {
    if (password !== confirm) return "As senhas não coincidem.";
    if (!evaluatePassword(password).valid) return "A senha não atende aos requisitos mínimos de segurança.";
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
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNfse.trim())) return "E-mail NFS-e inválido.";
    if (!responsavel.trim()) return "Nome do responsável é obrigatório.";
    const rt = responsavelTelefone.replace(/\D/g, "");
    if (!/^\d{10,11}$/.test(rt)) return "Telefone do responsável inválido.";
    const pessoasOk = pessoasPayload();
    if (pessoasOk.length === 0) {
      return "Cadastre ao menos uma pessoa autorizada com nome, CPF, e-mail e telefone válidos.";
    }
    return null;
  }

  function pessoasPayload() {
    return pessoasAutorizadas
      .map((p) => ({
        nome: p.nome.trim(),
        email: p.email.trim().toLowerCase(),
        cpf: p.cpf.replace(/\D/g, ""),
        telefone: p.telefone.replace(/\D/g, ""),
        permissoes: p.permissoes,
      }))
      .filter(
        (p) =>
          p.nome &&
          p.email &&
          p.cpf.length === 11 &&
          validateCpfDigits(p.cpf) &&
          /^\d{10,11}$/.test(p.telefone),
      );
  }

  function addPessoaRow() {
    setPessoasAutorizadas((prev) => [...prev, emptyPessoaDraft()]);
  }

  function removePessoaRow(index: number) {
    setPessoasAutorizadas((prev) => prev.filter((_, i) => i !== index));
  }

  function updatePessoaRow(
    index: number,
    field: "nome" | "email" | "cpf" | "telefone",
    value: string,
  ) {
    setPessoasAutorizadas((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
  }

  function togglePermissao(index: number, key: keyof PermissoesPessoa) {
    setPessoasAutorizadas((prev) =>
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
      };
    } else {
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
        responsavelTelefone: responsavelTelefone.replace(/\D/g, ""),
        responsavelEmail: emailNfse.trim().toLowerCase(),
        password,
        ...(pessoasPayload().length ? { pessoasAutorizadas: pessoasPayload() } : {}),
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
    <div className="flex min-h-screen flex-col items-center bg-[#080a0d] px-4 py-10">
      <div className="mb-8 flex max-w-3xl flex-col items-center gap-2 text-center">
        <div className="flex items-center gap-3">
          <RlLogo className="h-11 w-11 text-lg" />
          <div className="text-left">
            <h1 className="text-xl font-bold text-white">Criar conta</h1>
            <p className="text-sm text-slate-500">Portal do cliente</p>
          </div>
        </div>
      </div>

      <Card className="w-full max-w-3xl border-white/10">
        <CardHeader>
          <CardTitle>Cadastro</CardTitle>
          <CardDescription>
            {tipo === "PF"
              ? "Pessoa física: dados para NFS-e e acesso ao portal."
              : "Pessoa jurídica: dados do tomador e endereço para emissão de NFS-e."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void onSubmit(e)} className="space-y-8">
            <div className="space-y-4">
              <SectionTitle>Tipo de cadastro</SectionTitle>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={cn(
                    "rounded-md border px-4 py-2 text-sm",
                    tipo === "PJ" ? "border-[var(--accent)] bg-[var(--accent)]/15 text-white" : "border-white/15 text-slate-400",
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
                    "rounded-md border px-4 py-2 text-sm",
                    tipo === "PF" ? "border-[var(--accent)] bg-[var(--accent)]/15 text-white" : "border-white/15 text-slate-400",
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

            {tipo === "PF" ? (
              <div className="space-y-4">
                <SectionTitle hint={nfsePfHint}>Dados do cliente</SectionTitle>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <label className="text-sm font-medium text-slate-300">Nome completo</label>
                    <Input
                      className={REQUIRED_FIELD_CLASS}
                      value={nomeCompleto}
                      onChange={(e) => setNomeCompleto(e.target.value)}
                      required
                      autoComplete="name"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <label className="text-sm font-medium text-slate-300">CPF</label>
                    <Input
                      className={REQUIRED_FIELD_CLASS}
                      inputMode="numeric"
                      value={cpfCnpj}
                      onChange={(e) => setCpfCnpj(formatCpfBr(e.target.value))}
                      required
                      autoComplete="off"
                    />
                    {!tipoDocOk && docDigits.length >= 11 ? (
                      <p className="text-xs text-amber-400">Use apenas CPF (11 dígitos) para Pessoa Física.</p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">
                      Data de nascimento <span className="font-normal text-slate-500">(opcional)</span>
                    </label>
                    <Input
                      type="date"
                      value={dataNascimento}
                      onChange={(e) => setDataNascimento(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">E-mail (login)</label>
                    <Input
                      className={REQUIRED_FIELD_CLASS}
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Telefone</label>
                    <Input
                      className={REQUIRED_FIELD_CLASS}
                      value={telefone}
                      onChange={(e) => setTelefone(formatPhoneBr(e.target.value))}
                      inputMode="tel"
                      required
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <SectionTitle>Dados fiscais da empresa</SectionTitle>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <label className="text-sm font-medium text-slate-300">Razão social</label>
                    <Input
                      className={REQUIRED_FIELD_CLASS}
                      value={razaoSocial}
                      onChange={(e) => setRazaoSocial(e.target.value)}
                      required
                      autoComplete="organization"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <label className="text-sm font-medium text-slate-300">Nome fantasia</label>
                    <Input
                      className={REQUIRED_FIELD_CLASS}
                      value={nomeFantasia}
                      onChange={(e) => setNomeFantasia(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <label className="text-sm font-medium text-slate-300">CNPJ</label>
                    <Input
                      className={REQUIRED_FIELD_CLASS}
                      inputMode="numeric"
                      value={cpfCnpj}
                      onChange={(e) => setCpfCnpj(formatCpfCnpjBr(e.target.value))}
                      required
                    />
                    {!tipoDocOk && docDigits.length >= 14 ? (
                      <p className="text-xs text-amber-400">Use CNPJ (14 dígitos) para Pessoa Jurídica.</p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">E-mail</label>
                    <Input
                      className={REQUIRED_FIELD_CLASS}
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Telefone</label>
                    <Input
                      className={REQUIRED_FIELD_CLASS}
                      value={telefone}
                      onChange={(e) => setTelefone(formatPhoneBr(e.target.value))}
                      inputMode="tel"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Inscrição municipal</label>
                    <Input value={inscricaoMunicipal} onChange={(e) => setInscricaoMunicipal(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Inscrição estadual</label>
                    <Input value={inscricaoEstadual} onChange={(e) => setInscricaoEstadual(e.target.value)} disabled={isentoIE} />
                  </div>
                  <div className="flex items-center gap-2 sm:col-span-2">
                    <input
                      id="ie-exento"
                      type="checkbox"
                      checked={isentoIE}
                      onChange={(e) => setIsentoIE(e.target.checked)}
                      className="h-4 w-4 rounded border-white/20 bg-transparent"
                    />
                    <label htmlFor="ie-exento" className="text-sm text-slate-300">
                      Isento de IE
                    </label>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <SectionTitle>{tipo === "PF" ? "Endereço" : "Endereço fiscal"}</SectionTitle>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                    CEP
                    {cepLoading ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-400" aria-hidden />
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
                  {cepHint ? (
                    <p className="text-xs text-amber-400/90" role="status">
                      {cepHint}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <label className="text-sm font-medium text-slate-300">Logradouro</label>
                  <Input
                    className={REQUIRED_FIELD_CLASS}
                    value={enderecoLogradouro}
                    onChange={(e) => setEnderecoLogradouro(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Número</label>
                  <Input
                    className={REQUIRED_FIELD_CLASS}
                    value={enderecoNumero}
                    onChange={(e) => setEnderecoNumero(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Complemento</label>
                  <Input value={enderecoComplemento} onChange={(e) => setEnderecoComplemento(e.target.value)} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <label className="text-sm font-medium text-slate-300">Bairro</label>
                  <Input
                    className={REQUIRED_FIELD_CLASS}
                    value={enderecoBairro}
                    onChange={(e) => setEnderecoBairro(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label
                    className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-300"
                    title={
                      municipioLocked ? "Endereço encontrado automaticamente via CEP" : undefined
                    }
                  >
                    Cidade
                    {municipioLocked ? (
                      <span className="cursor-help text-[11px] font-normal text-slate-500" title="Endereço encontrado automaticamente via CEP">
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
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">UF</label>
                  <select
                    className={cn(REQUIRED_SELECT_CLASS, municipioLocked && "cursor-not-allowed opacity-90")}
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
                </div>
                <input
                  type="hidden"
                  name="codigoMunicipioIbge"
                  value={codigoMunicipioIbge.replace(/\D/g, "")}
                  readOnly
                  aria-hidden
                />
              </div>
            </div>

            {tipo === "PF" ? (
              <div className="space-y-4">
                <SectionTitle>Contato</SectionTitle>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">E-mail NFS-e</label>
                    <Input
                      type="email"
                      value={emailNfse}
                      onChange={(e) => setEmailNfse(e.target.value)}
                      placeholder={email.trim() || "mesmo e-mail do login"}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Telefone de contato</label>
                    <Input
                      value={telefoneContato}
                      onChange={(e) => setTelefoneContato(formatPhoneBr(e.target.value))}
                      inputMode="tel"
                      placeholder="Opcional — usa o telefone principal se vazio"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <SectionTitle>Contato para NFS-e</SectionTitle>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">E-mail NFS-e</label>
                    <Input
                      className={REQUIRED_FIELD_CLASS}
                      type="email"
                      value={emailNfse}
                      onChange={(e) => setEmailNfse(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <label className="text-sm font-medium text-slate-300">Responsável</label>
                    <Input
                      className={REQUIRED_FIELD_CLASS}
                      value={responsavel}
                      onChange={(e) => setResponsavel(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Telefone do responsável</label>
                    <Input
                      className={REQUIRED_FIELD_CLASS}
                      value={responsavelTelefone}
                      onChange={(e) => setResponsavelTelefone(formatPhoneBr(e.target.value))}
                      inputMode="tel"
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            {tipo === "PJ" ? (
            <div className="space-y-4">
              <SectionTitle hint="Usuários individuais que operarão com o login corporativo (CNPJ).">
                Pessoas autorizadas
              </SectionTitle>
              <p className="text-xs text-slate-500">
                Cadastre quem poderá se identificar após o login. Você pode adicionar quantas pessoas
                precisar.
              </p>
              <div className="space-y-4">
                {pessoasAutorizadas.map((pessoa, index) => (
                  <div
                    key={index}
                    className="grid gap-3 rounded-lg border border-white/10 bg-zinc-950/40 p-4 sm:grid-cols-2"
                  >
                    <div className="space-y-2 sm:col-span-2 flex items-center justify-between gap-2">
                      <span className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                        Pessoa {index + 1}
                        {index === 0 ? (
                          <span className="rounded-full border border-[var(--accent)]/40 bg-[var(--accent)]/15 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-orange-200">
                            Administrador
                          </span>
                        ) : null}
                      </span>
                      {pessoasAutorizadas.length > 1 ? (
                        <button
                          type="button"
                          className="text-xs text-red-400 hover:underline"
                          onClick={() => removePessoaRow(index)}
                        >
                          Remover
                        </button>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-300">Nome</label>
                      <Input
                        value={pessoa.nome}
                        onChange={(e) => updatePessoaRow(index, "nome", e.target.value)}
                        placeholder="Nome completo"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-300">E-mail</label>
                      <Input
                        type="email"
                        value={pessoa.email}
                        onChange={(e) => updatePessoaRow(index, "email", e.target.value)}
                        placeholder="email@empresa.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-300">CPF</label>
                      <Input
                        inputMode="numeric"
                        value={pessoa.cpf}
                        onChange={(e) => updatePessoaRow(index, "cpf", formatCpfBr(e.target.value))}
                        placeholder="000.000.000-00"
                        required
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <label className="text-sm font-medium text-slate-300">Telefone (WhatsApp)</label>
                      <Input
                        value={pessoa.telefone}
                        onChange={(e) => updatePessoaRow(index, "telefone", formatPhoneBr(e.target.value))}
                        inputMode="tel"
                        placeholder="(00) 00000-0000"
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Permissões operacionais
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {PERM_LABELS.map(({ key, label }) => (
                          <label key={key} className="flex items-center gap-2 text-sm text-slate-300">
                            <input
                              type="checkbox"
                              checked={pessoa.permissoes[key]}
                              onChange={() => togglePermissao(index, key)}
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "border-white/20")}
                  onClick={addPessoaRow}
                >
                  + Adicionar Pessoa
                </button>
              </div>
            </div>
            ) : null}

            <div className="space-y-4">
              <SectionTitle>Acesso ao portal</SectionTitle>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Senha</label>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    className={REQUIRED_FIELD_CLASS}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Confirmar senha</label>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    className={REQUIRED_FIELD_CLASS}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    minLength={8}
                  />
                </div>
                <div className="sm:col-span-2">
                  <PasswordStrengthPanel password={password} />
                </div>
              </div>
            </div>

            {err ? (
              <p className="rounded-lg border border-red-500/40 bg-red-950/50 px-3 py-2 text-sm text-red-200" role="alert">
                {err}
              </p>
            ) : null}
            <p className="text-[11px] text-slate-500">API: {getApiBase()}</p>
            <button
              type="submit"
              disabled={submitting}
              className={cn(buttonVariants({ variant: "default", size: "default" }), "w-full min-h-10")}
            >
              {submitting ? "Enviando…" : "Cadastrar"}
            </button>
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
