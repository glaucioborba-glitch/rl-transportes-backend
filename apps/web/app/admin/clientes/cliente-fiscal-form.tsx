"use client";

import { useEffect, useRef, useState } from "react";
import { HelpCircle, Loader2 } from "lucide-react";
import { useCepLookup } from "@/hooks/use-cep-lookup";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ApiError, staffJson } from "@/lib/api/staff-client";
import {
  BR_UF,
  formatCepBr,
  formatIbge7,
  formatPhoneBr,
} from "@/lib/nfse/cliente-fiscal";
import { formatCpfBr, formatCpfCnpjBr } from "@/lib/format-cpf-cnpj-br";
import { toast } from "@/lib/toast";

/** Borda laranja em campos de preenchimento obrigatório (cadastro PF / PJ). */
const REQUIRED_INPUT_CLASS =
  "border-orange-500 bg-zinc-900 text-zinc-100 focus-visible:ring-2 focus-visible:ring-orange-500/50";
const REQUIRED_SELECT_CLASS =
  "border-orange-500 bg-zinc-900 text-zinc-100 focus-visible:ring-2 focus-visible:ring-orange-500/50 rounded-md";
const OPTIONAL_INPUT_CLASS = "border-zinc-700 bg-zinc-900 text-zinc-100";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="border-b border-zinc-700 pb-2 text-sm font-semibold tracking-wide text-zinc-200">{children}</h2>
  );
}

function FieldHint({ text }: { text: string }) {
  return (
    <span className="inline-flex cursor-help text-zinc-500" title={text}>
      <HelpCircle className="h-3.5 w-3.5" aria-hidden />
    </span>
  );
}

function formatOptionalPercent(value: number | string | null | undefined): string {
  if (value == null || value === "") return "";
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? String(n) : "";
}

function formatTermosAceite(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function financeFieldPayload(
  raw: string,
  editing: boolean,
): number | null | undefined {
  const trimmed = raw.trim();
  if (trimmed === "") return editing ? null : undefined;
  const n = parseFloat(trimmed.replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

type ClienteApi = {
  tipo: "PF" | "PJ";
  razaoSocial: string;
  nomeFantasia?: string | null;
  dataNascimento?: string | null;
  cpfCnpj: string;
  inscricaoMunicipal?: string | null;
  inscricaoEstadual?: string | null;
  isentoIE: boolean;
  email: string;
  emailNfse: string;
  telefone: string;
  enderecoLogradouro: string;
  enderecoNumero: string;
  enderecoComplemento?: string | null;
  enderecoBairro: string;
  enderecoCidade: string;
  enderecoUf: string;
  enderecoCep: string;
  codigoMunicipioIbge?: string | null;
  responsavel?: string | null;
  responsavelTelefone?: string | null;
  responsavelEmail?: string | null;
  diasToleranciaBloqueio?: number | null;
  percentualMultaAtraso?: number | string | null;
  percentualJurosAoMes?: number | string | null;
  termosAceitosEm?: string | null;
  termosAceitosIp?: string | null;
  termosVersao?: string | null;
};

export function ClienteAdminFiscalForm({ clienteId }: { clienteId?: string }) {
  const [tipo, setTipo] = useState<"PF" | "PJ">("PJ");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [inscricaoMunicipal, setInscricaoMunicipal] = useState("");
  const [inscricaoEstadual, setInscricaoEstadual] = useState("");
  const [isentoIE, setIsentoIE] = useState(false);
  const [email, setEmail] = useState("");
  const [emailNfse, setEmailNfse] = useState("");
  const [telefone, setTelefone] = useState("");
  const [enderecoLogradouro, setEnderecoLogradouro] = useState("");
  const [enderecoNumero, setEnderecoNumero] = useState("");
  const [enderecoComplemento, setEnderecoComplemento] = useState("");
  const [enderecoBairro, setEnderecoBairro] = useState("");
  const [enderecoCidade, setEnderecoCidade] = useState("");
  const [enderecoUf, setEnderecoUf] = useState("SC");
  const [enderecoCep, setEnderecoCep] = useState("");
  const [codigoMunicipioIbge, setCodigoMunicipioIbge] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [telefoneContato, setTelefoneContato] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [responsavelTelefone, setResponsavelTelefone] = useState("");
  const [responsavelEmail, setResponsavelEmail] = useState("");
  const [diasToleranciaBloqueio, setDiasToleranciaBloqueio] = useState("");
  const [percentualMultaAtraso, setPercentualMultaAtraso] = useState("");
  const [percentualJurosAoMes, setPercentualJurosAoMes] = useState("");
  const [termosAceitosEm, setTermosAceitosEm] = useState<string | null>(null);
  const [termosAceitosIp, setTermosAceitosIp] = useState<string | null>(null);
  const [termosVersao, setTermosVersao] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(!!clienteId);

  const { loading: cepLoading, cepHint, data: cepLookupData, cepValido, cepDigits } =
    useCepLookup(enderecoCep);

  /** Evita sobrescrever endereço já persistido ao carregar o cliente (só preenche após o usuário alterar o CEP). */
  const cepAutofillAllowed = useRef(false);

  useEffect(() => {
    if (!cepLookupData || !cepAutofillAllowed.current) return;
    if (cepLookupData.logradouro) setEnderecoLogradouro(cepLookupData.logradouro);
    if (cepLookupData.bairro) setEnderecoBairro(cepLookupData.bairro);
    if (cepLookupData.cidade) setEnderecoCidade(cepLookupData.cidade);
    if (cepLookupData.uf) setEnderecoUf(cepLookupData.uf.toUpperCase());
    if (cepLookupData.ibge) setCodigoMunicipioIbge(formatIbge7(cepLookupData.ibge));
    setEnderecoCep(formatCepBr(cepLookupData.cep));
  }, [cepLookupData]);

  const municipioLocked =
    cepAutofillAllowed.current && Boolean(cepValido && cepDigits.length === 8);

  useEffect(() => {
    if (!clienteId) return;
    let cancelled = false;
    setLoading(true);
    void staffJson<ClienteApi>(`/clientes/${clienteId}`)
      .then((c) => {
        if (cancelled) return;
        setTipo(c.tipo);
        setRazaoSocial(c.razaoSocial);
        setNomeFantasia(c.nomeFantasia ?? "");
        if (c.dataNascimento) {
          setDataNascimento(new Date(c.dataNascimento).toISOString().slice(0, 10));
        } else {
          setDataNascimento("");
        }
        const digits = c.cpfCnpj.replace(/\D/g, "");
        const pf11 =
          c.tipo === "PF" ? (digits.replace(/^0+/, "").slice(-11) || digits.slice(-11)) : digits;
        setCpfCnpj(c.tipo === "PF" ? formatCpfBr(pf11) : formatCpfCnpjBr(digits));
        setInscricaoMunicipal(c.inscricaoMunicipal ?? "");
        setInscricaoEstadual(c.inscricaoEstadual ?? "");
        setIsentoIE(c.isentoIE);
        setEmail(c.email);
        setEmailNfse(c.emailNfse);
        setTelefone(formatPhoneBr(c.telefone));
        setEnderecoLogradouro(c.enderecoLogradouro);
        setEnderecoNumero(c.enderecoNumero);
        setEnderecoComplemento(c.enderecoComplemento ?? "");
        setEnderecoBairro(c.enderecoBairro);
        setEnderecoCidade(c.enderecoCidade);
        setEnderecoUf(c.enderecoUf);
        setEnderecoCep(formatCepBr(c.enderecoCep));
        setCodigoMunicipioIbge(formatIbge7(c.codigoMunicipioIbge ?? ""));
        setResponsavel(c.responsavel ?? "");
        setResponsavelTelefone(formatPhoneBr(c.responsavelTelefone ?? ""));
        setResponsavelEmail(c.responsavelEmail ?? "");
        setDiasToleranciaBloqueio(
          c.diasToleranciaBloqueio != null ? String(c.diasToleranciaBloqueio) : "",
        );
        setPercentualMultaAtraso(formatOptionalPercent(c.percentualMultaAtraso));
        setPercentualJurosAoMes(formatOptionalPercent(c.percentualJurosAoMes));
        setTermosAceitosEm(c.termosAceitosEm ?? null);
        setTermosAceitosIp(c.termosAceitosIp ?? null);
        setTermosVersao(c.termosVersao ?? null);
      })
      .catch((err: unknown) => {
        toast.error(err instanceof ApiError ? err.message : "Erro ao carregar cliente");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clienteId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (tipo === "PJ" && !nomeFantasia.trim()) {
      toast.error("Nome fantasia obrigatório para PJ.");
      return;
    }
    if (tipo === "PF" && !dataNascimento.trim()) {
      toast.error("Data de nascimento é obrigatória para PF.");
      return;
    }

    let body: Record<string, unknown>;
    if (tipo === "PF") {
      body = {
        nomeCompleto: razaoSocial.trim(),
        tipo: "PF",
        cpfCnpj,
        dataNascimento: dataNascimento.trim(),
        email: email.trim(),
        telefone: telefone.replace(/\D/g, ""),
        emailNfse: emailNfse.trim() ? emailNfse.trim().toLowerCase() : undefined,
        telefoneContato: telefoneContato.replace(/\D/g, "") || undefined,
        enderecoLogradouro: enderecoLogradouro.trim(),
        enderecoNumero: enderecoNumero.trim(),
        enderecoComplemento: enderecoComplemento.trim() || undefined,
        enderecoBairro: enderecoBairro.trim(),
        enderecoCidade: enderecoCidade.trim(),
        enderecoUf: enderecoUf.trim().toUpperCase(),
        enderecoCep: enderecoCep.replace(/\D/g, ""),
        codigoMunicipioIbge: codigoMunicipioIbge.replace(/\D/g, ""),
      };
    } else {
      body = {
        razaoSocial: razaoSocial.trim(),
        tipo: "PJ",
        nomeFantasia: nomeFantasia.trim(),
        cpfCnpj,
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
        codigoMunicipioIbge: codigoMunicipioIbge.replace(/\D/g, ""),
        responsavel: responsavel.trim(),
        responsavelTelefone: responsavelTelefone.replace(/\D/g, ""),
        responsavelEmail: responsavelEmail.trim(),
      };
    }

    setSubmitting(true);
    try {
      const financeiro = {
        diasToleranciaBloqueio: financeFieldPayload(diasToleranciaBloqueio, Boolean(clienteId)),
        percentualMultaAtraso: financeFieldPayload(percentualMultaAtraso, Boolean(clienteId)),
        percentualJurosAoMes: financeFieldPayload(percentualJurosAoMes, Boolean(clienteId)),
      };
      const financeiroPatch = Object.fromEntries(
        Object.entries(financeiro).filter(([, v]) => v !== undefined),
      );

      if (clienteId) {
        await staffJson<unknown>(`/clientes/${clienteId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, ...financeiroPatch }),
        });
        toast.success("Cliente atualizado.");
      } else {
        await staffJson<unknown>("/clientes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, ...financeiroPatch }),
        });
        toast.success("Cliente criado.");
        window.location.href = "/admin/executivo";
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : clienteId ? "Erro ao atualizar cliente" : "Erro ao criar cliente");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading && clienteId) {
    return (
      <Card className="border-zinc-800 bg-zinc-950">
        <CardContent className="py-12 text-center text-sm text-zinc-500">Carregando dados do cliente…</CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-zinc-800 bg-zinc-950">
      <CardHeader>
        <CardTitle className="text-zinc-100">Dados cadastrais</CardTitle>
        <CardDescription className="text-zinc-500">
          {clienteId
            ? "PATCH /clientes/:id · atualização fiscal NFS-e"
            : "Mesmos campos do cadastro portal; permissões ADMIN / GERENTE."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-8">
          <div className="space-y-4">
            <SectionTitle>Empresa / cliente</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex gap-2 sm:col-span-2">
                <button
                  type="button"
                  className={cn(
                    "rounded-md border px-3 py-2 text-sm",
                    tipo === "PJ" ? "border-emerald-600 bg-emerald-950/40 text-white" : "border-zinc-700 text-zinc-400",
                  )}
                  onClick={() => setTipo("PJ")}
                >
                  PJ
                </button>
                <button
                  type="button"
                  className={cn(
                    "rounded-md border px-3 py-2 text-sm",
                    tipo === "PF" ? "border-emerald-600 bg-emerald-950/40 text-white" : "border-zinc-700 text-zinc-400",
                  )}
                  onClick={() => setTipo("PF")}
                >
                  PF
                </button>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <label className="text-xs font-medium text-zinc-400">
                  {tipo === "PJ" ? "Razão social" : "Nome completo"}
                </label>
                <Input
                  className={REQUIRED_INPUT_CLASS}
                  value={razaoSocial}
                  onChange={(e) => setRazaoSocial(e.target.value)}
                  required
                />
              </div>
              {tipo === "PJ" ? (
                <div className="space-y-2 sm:col-span-2">
                  <label className="text-xs font-medium text-zinc-400">Nome fantasia</label>
                  <Input
                    className={REQUIRED_INPUT_CLASS}
                    value={nomeFantasia}
                    onChange={(e) => setNomeFantasia(e.target.value)}
                    required
                  />
                </div>
              ) : null}
              <div className="space-y-2 sm:col-span-2">
                <label className="text-xs font-medium text-zinc-400">{tipo === "PF" ? "CPF" : "CNPJ"}</label>
                <Input
                  className={REQUIRED_INPUT_CLASS}
                  value={cpfCnpj}
                  onChange={(e) =>
                    setCpfCnpj(tipo === "PF" ? formatCpfBr(e.target.value) : formatCpfCnpjBr(e.target.value))
                  }
                  required
                />
              </div>
              {tipo === "PF" ? (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-400">Data de nascimento</label>
                  <Input
                    type="date"
                    className={REQUIRED_INPUT_CLASS}
                    value={dataNascimento}
                    onChange={(e) => setDataNascimento(e.target.value)}
                    required
                  />
                </div>
              ) : null}
              {tipo === "PJ" ? (
                <>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-zinc-400">Inscrição municipal</label>
                    <Input
                      className={OPTIONAL_INPUT_CLASS}
                      value={inscricaoMunicipal}
                      onChange={(e) => setInscricaoMunicipal(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-zinc-400">Inscrição estadual</label>
                    <Input
                      className={OPTIONAL_INPUT_CLASS}
                      value={inscricaoEstadual}
                      onChange={(e) => setInscricaoEstadual(e.target.value)}
                      disabled={isentoIE}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-zinc-300 sm:col-span-2">
                    <input type="checkbox" checked={isentoIE} onChange={(e) => setIsentoIE(e.target.checked)} />
                    Isento de IE
                  </label>
                </>
              ) : null}
            </div>
          </div>

          <div className="space-y-4">
            <SectionTitle>{tipo === "PF" ? "Endereço" : "Endereço fiscal"}</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <label className="flex items-center gap-2 text-xs font-medium text-zinc-400">
                  CEP
                  {cepLoading ? (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-zinc-500" aria-hidden />
                  ) : null}
                </label>
                <Input
                  className={REQUIRED_INPUT_CLASS}
                  value={enderecoCep}
                  onChange={(e) => {
                    cepAutofillAllowed.current = true;
                    setEnderecoCep(formatCepBr(e.target.value));
                  }}
                  required
                  inputMode="numeric"
                  autoComplete="postal-code"
                />
                {cepHint ? (
                  <p className="text-xs text-amber-400/90" role="status">
                    {cepHint}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2 sm:col-span-2">
                <label className="text-xs font-medium text-zinc-400">Logradouro</label>
                <Input
                  className={REQUIRED_INPUT_CLASS}
                  value={enderecoLogradouro}
                  onChange={(e) => setEnderecoLogradouro(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-400">Número</label>
                <Input
                  className={REQUIRED_INPUT_CLASS}
                  value={enderecoNumero}
                  onChange={(e) => setEnderecoNumero(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-400">Complemento</label>
                <Input
                  className={OPTIONAL_INPUT_CLASS}
                  value={enderecoComplemento}
                  onChange={(e) => setEnderecoComplemento(e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <label className="text-xs font-medium text-zinc-400">Bairro</label>
                <Input
                  className={REQUIRED_INPUT_CLASS}
                  value={enderecoBairro}
                  onChange={(e) => setEnderecoBairro(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label
                  className="flex flex-wrap items-center gap-2 text-xs font-medium text-zinc-400"
                  title={municipioLocked ? "Endereço encontrado automaticamente via CEP" : undefined}
                >
                  Cidade
                  {municipioLocked ? (
                    <span
                      className="cursor-help text-[10px] font-normal text-zinc-600"
                      title="Endereço encontrado automaticamente via CEP"
                    >
                      (?)
                    </span>
                  ) : null}
                </label>
                <Input
                  className={cn(
                    REQUIRED_INPUT_CLASS,
                    municipioLocked && "cursor-not-allowed opacity-90",
                  )}
                  value={enderecoCidade}
                  readOnly={municipioLocked}
                  onChange={(e) => setEnderecoCidade(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-400">UF</label>
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
              <div className="space-y-2 sm:col-span-2">
                <label
                  className="flex flex-wrap items-center gap-2 text-xs font-medium text-zinc-400"
                  title={municipioLocked ? "Endereço encontrado automaticamente via CEP" : undefined}
                >
                  Código município IBGE
                  {municipioLocked ? (
                    <span
                      className="cursor-help text-[10px] font-normal text-zinc-600"
                      title="Endereço encontrado automaticamente via CEP"
                    >
                      (?)
                    </span>
                  ) : null}
                </label>
                <Input
                  className={cn(
                    REQUIRED_INPUT_CLASS,
                    municipioLocked && "cursor-not-allowed opacity-90",
                  )}
                  value={codigoMunicipioIbge}
                  readOnly={municipioLocked}
                  onChange={(e) => setCodigoMunicipioIbge(formatIbge7(e.target.value))}
                  required
                  inputMode="numeric"
                />
                <p className="text-[11px] text-zinc-600">
                  {municipioLocked
                    ? "Preenchido automaticamente a partir do CEP (base IBGE)."
                    : "Digite o CEP (8 dígitos) para preencher cidade, UF e IBGE automaticamente."}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <SectionTitle>{tipo === "PF" ? "Contato" : "Contato NFS-e"}</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-400">E-mail</label>
                <Input
                  type="email"
                  className={REQUIRED_INPUT_CLASS}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-400">E-mail NFS-e</label>
                <Input
                  type="email"
                  className={tipo === "PJ" ? REQUIRED_INPUT_CLASS : OPTIONAL_INPUT_CLASS}
                  value={emailNfse}
                  onChange={(e) => setEmailNfse(e.target.value)}
                  required={tipo === "PJ"}
                  placeholder={tipo === "PF" ? "Opcional — igual ao login se vazio" : undefined}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <label className="text-xs font-medium text-zinc-400">Telefone</label>
                <Input
                  className={REQUIRED_INPUT_CLASS}
                  value={telefone}
                  onChange={(e) => setTelefone(formatPhoneBr(e.target.value))}
                  required
                />
              </div>
              {tipo === "PF" ? (
                <div className="space-y-2 sm:col-span-2">
                  <label className="text-xs font-medium text-zinc-400">Telefone de contato (NFS-e)</label>
                  <Input
                    className={OPTIONAL_INPUT_CLASS}
                    value={telefoneContato}
                    onChange={(e) => setTelefoneContato(formatPhoneBr(e.target.value))}
                    placeholder="Opcional — usa o telefone principal se vazio"
                  />
                </div>
              ) : (
                <>
                  <div className="space-y-2 sm:col-span-2">
                    <label className="text-xs font-medium text-zinc-400">Responsável</label>
                    <Input
                      className={REQUIRED_INPUT_CLASS}
                      value={responsavel}
                      onChange={(e) => setResponsavel(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-zinc-400">Tel. responsável</label>
                    <Input
                      className={REQUIRED_INPUT_CLASS}
                      value={responsavelTelefone}
                      onChange={(e) => setResponsavelTelefone(formatPhoneBr(e.target.value))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-zinc-400">E-mail responsável</label>
                    <Input
                      type="email"
                      className={REQUIRED_INPUT_CLASS}
                      value={responsavelEmail}
                      onChange={(e) => setResponsavelEmail(e.target.value)}
                      required
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <SectionTitle>Financeiro / Faturamento</SectionTitle>
            <p className="text-xs text-zinc-500">
              Parametrize multa, juros e tolerância de bloqueio por cliente. Valores em branco usam a
              regra padrão do terminal.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-400">
                  Multa por atraso (%)
                  <FieldHint text="Se deixado em branco, o sistema utilizará a regra padrão do Terminal." />
                </label>
                <Input
                  className={OPTIONAL_INPUT_CLASS}
                  value={percentualMultaAtraso}
                  onChange={(e) => setPercentualMultaAtraso(e.target.value)}
                  inputMode="decimal"
                  placeholder="Ex.: 2"
                />
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-400">
                  Juros (% a.m.)
                  <FieldHint text="Se deixado em branco, o sistema utilizará a regra padrão do Terminal." />
                </label>
                <Input
                  className={OPTIONAL_INPUT_CLASS}
                  value={percentualJurosAoMes}
                  onChange={(e) => setPercentualJurosAoMes(e.target.value)}
                  inputMode="decimal"
                  placeholder="Ex.: 1"
                />
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-400">
                  Dias tolerância bloqueio
                  <FieldHint text="Se deixado em branco, o sistema utilizará a regra padrão do Terminal." />
                </label>
                <Input
                  className={OPTIONAL_INPUT_CLASS}
                  value={diasToleranciaBloqueio}
                  onChange={(e) => setDiasToleranciaBloqueio(e.target.value.replace(/\D/g, ""))}
                  inputMode="numeric"
                  placeholder="Ex.: 30"
                />
              </div>
            </div>
          </div>

          {clienteId ? (
            <div className="space-y-3 rounded-lg border border-zinc-700/80 bg-zinc-950/50 p-4">
              <SectionTitle>Compliance Jurídico</SectionTitle>
              {termosAceitosEm ? (
                <p className="text-sm text-zinc-300">
                  Termos aceitos em:{" "}
                  <span className="font-medium text-zinc-100">{formatTermosAceite(termosAceitosEm)}</span>
                  {termosAceitosIp ? (
                    <>
                      {" "}
                      · IP: <span className="font-mono text-zinc-100">{termosAceitosIp}</span>
                    </>
                  ) : null}
                  {termosVersao ? (
                    <>
                      {" "}
                      · Versão: <span className="font-medium text-zinc-100">{termosVersao}</span>
                    </>
                  ) : null}
                </p>
              ) : (
                <p className="text-sm text-zinc-500">
                  Nenhum aceite de Termos de Uso registrado (cadastro intranet ou cliente anterior à
                  exigência de aceite).
                </p>
              )}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className={cn(buttonVariants({ variant: "default" }), "w-full")}
          >
            {submitting ? "Salvando…" : clienteId ? "Salvar alterações" : "Criar cliente"}
          </button>
        </form>
      </CardContent>
    </Card>
  );
}
