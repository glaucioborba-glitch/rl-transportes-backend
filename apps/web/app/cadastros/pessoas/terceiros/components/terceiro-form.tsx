"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Banknote, FileUp, Minus, Plus, Save, Truck, User, X } from "lucide-react";
import { FormField, FormSection, CADASTRO_FORM_CLASS } from "@/components/cadastros/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/staff-client";
import {
  CNH_CATEGORIAS,
  createCadastroTerceiro,
  docCarretaNoIndice,
  extrairDocumentoTerceiro,
  getCadastroTerceiro,
  pinosFromCapacidadeTerceiro,
  updateCadastroTerceiro,
  urlArquivoDocumentoTerceiro,
  type CadastroTerceiroDocumento,
  type CadastroTerceiroWrite,
  type CarretaTerceiro,
  type TipoDocumentoTerceiro,
} from "@/lib/api/cadastros-terceiros-client";
import { listCadastrosTiposContainer } from "@/lib/api/cadastros-tipos-container-client";
import {
  formatTamanhoContainerDisplay,
  normalizeTamanhoContainer,
  normalizeTamanhosContainer,
  TAMANHOS_CONTAINER_OPCOES,
  tamanhoContainerSelecionado,
} from "@/lib/cadastros/tipo-container-tamanhos";
import { formatCpfBr } from "@/lib/format-cpf-cnpj-br";
import { isValidCPF } from "@/lib/cadastros/formatters";
import { formatPhoneBr } from "@/lib/nfse/cliente-fiscal";
import { isValidPlacaMercosul } from "@/lib/placa-mercosul";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm";

const EMPTY: CadastroTerceiroWrite = {
  motoristaNome: "",
  motoristaCpf: "",
  donoNome: "",
  pix: "",
  placaCavalo: "",
  renavamCavalo: "",
  crlvValidadeCavalo: "",
  placaCarreta: "",
  placaCarreta02: "",
  placasCarretas: [],
  carretas: [],
  cnhCategoria: "",
  cnhValidade: "",
  whatsapp: "",
  capacidade: "AMBOS",
  ativo: true,
};

type CarretaDraft = {
  placa: string;
  pinos: string[];
  renavam: string;
  validadeDocumento: string;
};

function emptyCarreta(pinos: string[] = [...TAMANHOS_CONTAINER_OPCOES]): CarretaDraft {
  return { placa: "", pinos, renavam: "", validadeDocumento: "" };
}

type Props = { terceiroId?: string };

function normalizePlacaInput(value: string) {
  return value.replace(/[\s-]/g, "").toUpperCase();
}

export function TerceiroForm({ terceiroId }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(terceiroId));
  const [formData, setFormData] = useState(EMPTY);
  const [mesmoDono, setMesmoDono] = useState(false);
  const [carretas, setCarretas] = useState<CarretaDraft[]>([emptyCarreta()]);
  const [docs, setDocs] = useState<CadastroTerceiroDocumento[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [pinosCatalogo, setPinosCatalogo] = useState<string[]>([...TAMANHOS_CONTAINER_OPCOES]);

  useEffect(() => {
    if (!terceiroId) return;
    let on = true;
    void (async () => {
      try {
        const data = await getCadastroTerceiro(terceiroId);
        if (!on) return;
        const loaded: CarretaDraft[] = (data.carretas?.length ? data.carretas : []).map((c) => ({
          placa: c.placa ?? "",
          pinos: c.pinos?.length
            ? normalizeTamanhosContainer(c.pinos)
            : pinosFromCapacidadeTerceiro(c.capacidade ?? data.capacidade),
          renavam: c.renavam ?? "",
          validadeDocumento: c.validadeDocumento ?? "",
        }));
        if (!loaded.length) {
          const placas = data.placasCarretas?.length
            ? data.placasCarretas
            : [data.placaCarreta, data.placaCarreta02].filter((p): p is string => Boolean(p));
          const pinos = pinosFromCapacidadeTerceiro(data.capacidade);
          loaded.push(
            ...(placas.length
              ? placas.map((placa) => ({
                  placa,
                  pinos,
                  renavam: "",
                  validadeDocumento: "",
                }))
              : [emptyCarreta(pinos)]),
          );
        }
        setFormData({
          motoristaNome: data.motoristaNome,
          motoristaCpf: data.motoristaCpf,
          donoNome: data.donoNome,
          pix: data.pix,
          placaCavalo: data.placaCavalo,
          renavamCavalo: data.renavamCavalo ?? "",
          crlvValidadeCavalo: data.crlvValidadeCavalo ?? "",
          placaCarreta: loaded[0]?.placa ?? "",
          placaCarreta02: loaded[1]?.placa ?? "",
          placasCarretas: loaded.map((c) => c.placa),
          carretas: loaded,
          cnhCategoria: data.cnhCategoria ?? "",
          cnhValidade: data.cnhValidade ?? "",
          whatsapp: data.whatsapp ?? "",
          capacidade: data.capacidade,
          ativo: data.ativo,
        });
        setCarretas(loaded);
        setDocs(data.documentos ?? []);
        setMesmoDono(
          Boolean(data.donoNome.trim()) &&
            data.donoNome.trim().toLowerCase() === data.motoristaNome.trim().toLowerCase(),
        );
      } catch {
        toast.error("Erro ao carregar terceiro.");
      } finally {
        if (on) setLoading(false);
      }
    })();
    return () => {
      on = false;
    };
  }, [terceiroId]);

  useEffect(() => {
    let on = true;
    void listCadastrosTiposContainer()
      .then((data) => {
        if (!on) return;
        const tamanhos = normalizeTamanhosContainer(
          (data.items ?? []).filter((t) => t.ativo).flatMap((t) => t.tamanhos),
        );
        if (tamanhos.length) setPinosCatalogo(tamanhos);
      })
      .catch(() => undefined);
    return () => {
      on = false;
    };
  }, []);

  async function onUpload(tipo: TipoDocumentoTerceiro, file: File | undefined, indice?: number) {
    if (!file) return;
    const key = tipo === "CRLV_CARRETA" ? `carreta-${indice ?? 0}` : tipo;
    setUploading(key);
    try {
      const out = await extrairDocumentoTerceiro({ arquivo: file, tipo, terceiroId, indice });
      setDocs((prev) => {
        if (tipo === "CRLV_CARRETA" || tipo === "CRLV_CARRETA_02") {
          const i = out.indice ?? indice ?? 0;
          return [...prev.filter((d) => docCarretaNoIndice([d], i) == null), out];
        }
        return [...prev.filter((d) => d.tipo !== tipo), out];
      });
      toast.success("Documento lido. Confira as sugestões antes de aplicar.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível ler o documento.");
    } finally {
      setUploading(null);
    }
  }

  function validarCpfCampo(cpf: string) {
    const clean = cpf.replace(/\D/g, "");
    if (clean.length !== 11) return;
    if (!isValidCPF(clean)) {
      toast.error("CPF inválido — dígitos verificadores não conferem.");
    }
  }

  function validarPlacaCampo(placa: string, label: string) {
    const n = normalizePlacaInput(placa);
    if (!n) return;
    if (!isValidPlacaMercosul(n)) {
      toast.error(`${label}: placa inválida. Use Mercosul (ABC1D23) ou o formato antigo (ABC1234).`);
    }
  }

  function aplicar(doc: CadastroTerceiroDocumento) {
    const s = doc.sugestoes ?? doc.extraido ?? {};
    const avisos: string[] = [];
    const cpfOk = s.cpf && isValidCPF(s.cpf);
    const placaOk = s.placa && isValidPlacaMercosul(s.placa);
    if (s.cpf && !cpfOk) avisos.push("CPF extraído não confere");
    if (s.placa && !placaOk) avisos.push("placa extraída inválida");

    if (doc.tipo === "CNH") {
      setFormData((prev) => ({
        ...prev,
        motoristaNome: s.nome || prev.motoristaNome,
        motoristaCpf: cpfOk ? s.cpf! : prev.motoristaCpf,
        cnhCategoria: s.cnhCategoria || prev.cnhCategoria,
        cnhValidade: s.cnhValidade || prev.cnhValidade,
        donoNome: mesmoDono && s.nome ? s.nome : prev.donoNome,
      }));
    } else if (doc.tipo === "CRLV_CAVALO") {
      setFormData((prev) => ({
        ...prev,
        placaCavalo: placaOk ? s.placa! : prev.placaCavalo,
        renavamCavalo: s.renavam || prev.renavamCavalo,
        crlvValidadeCavalo: s.crlvValidade || prev.crlvValidadeCavalo,
        donoNome: !mesmoDono && s.donoNome ? s.donoNome : prev.donoNome,
      }));
    } else {
      const i = doc.indice ?? (doc.tipo === "CRLV_CARRETA_02" ? 1 : 0);
      setCarretas((prev) => {
        const next = [...prev];
        while (next.length <= i) next.push(emptyCarreta());
        next[i] = {
          ...next[i],
          placa: placaOk ? s.placa! : next[i].placa,
          renavam: s.renavam || next[i].renavam,
          validadeDocumento: s.crlvValidade || next[i].validadeDocumento,
        };
        return next;
      });
      if (!mesmoDono && s.donoNome) {
        setFormData((prev) => ({ ...prev, donoNome: s.donoNome! }));
      }
    }
    if (avisos.length) {
      toast.error(`${avisos.join(" e ")} — preencha à mão.`);
    } else {
      toast.success("Sugestões aplicadas. Revise e salve a ficha.");
    }
  }

  function patchCarreta(index: number, patch: Partial<CarretaDraft>) {
    setCarretas((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  function removeCarreta(index: number) {
    setCarretas((prev) => (prev.length <= 1 ? [emptyCarreta()] : prev.filter((_, i) => i !== index)));
    setDocs((prev) =>
      prev
        .filter((d) => docCarretaNoIndice([d], index) == null)
        .map((d) => {
          if (d.tipo !== "CRLV_CARRETA" && d.tipo !== "CRLV_CARRETA_02") return d;
          const i = d.indice ?? (d.tipo === "CRLV_CARRETA_02" ? 1 : 0);
          return i > index ? { ...d, indice: i - 1 } : d;
        }),
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cpf = formData.motoristaCpf.replace(/\D/g, "");
    if (!formData.motoristaNome.trim()) {
      toast.error("Informe o nome do motorista.");
      return;
    }
    if (!isValidCPF(cpf)) {
      toast.error("CPF inválido — dígitos verificadores não conferem.");
      return;
    }
    const donoNome = (mesmoDono ? formData.motoristaNome : formData.donoNome).trim();
    if (!isValidPlacaMercosul(formData.placaCavalo)) {
      toast.error("Placa do cavalo inválida. Use Mercosul (ABC1D23) ou o formato antigo (ABC1234).");
      return;
    }
    for (const [i, c] of carretas.entries()) {
      const placa = normalizePlacaInput(c.placa);
      if (!placa) continue;
      if (!isValidPlacaMercosul(placa)) {
        toast.error(
          `${i === 0 ? "Carreta" : `Carreta ${i + 1}`}: placa inválida. Use Mercosul (ABC1D23) ou o formato antigo (ABC1234).`,
        );
        return;
      }
    }
    for (const [i, c] of carretas.entries()) {
      if (normalizePlacaInput(c.placa) && !c.pinos.length) {
        toast.error(
          `${i === 0 ? "Carreta" : `Carreta ${i + 1}`}: selecione a capacidade (pinos) pelos tamanhos do cadastro de tipos de contêiner.`,
        );
        return;
      }
    }
    const carretasPayload: CarretaTerceiro[] = carretas
      .map((c) => ({
        placa: normalizePlacaInput(c.placa),
        pinos: normalizeTamanhosContainer(c.pinos),
        renavam: c.renavam.replace(/\D/g, "") || null,
        validadeDocumento: c.validadeDocumento.trim() || null,
      }))
      .filter((c) => isValidPlacaMercosul(c.placa));
    setSaving(true);
    try {
      const payload: CadastroTerceiroWrite = {
        ...formData,
        motoristaNome: formData.motoristaNome.trim(),
        motoristaCpf: cpf,
        donoNome,
        pix: formData.pix.trim(),
        placaCavalo: normalizePlacaInput(formData.placaCavalo),
        renavamCavalo: (formData.renavamCavalo ?? "").replace(/\D/g, "") || null,
        crlvValidadeCavalo: formData.crlvValidadeCavalo?.trim() || null,
        placaCarreta: carretasPayload[0]?.placa ?? null,
        placaCarreta02: carretasPayload[1]?.placa ?? null,
        placasCarretas: carretasPayload.map((c) => c.placa),
        carretas: carretasPayload,
        cnhCategoria: formData.cnhCategoria?.trim().toUpperCase() || null,
        cnhValidade: formData.cnhValidade?.trim() || null,
        whatsapp: (formData.whatsapp ?? "").replace(/\D/g, "") || null,
        documentoIds: docs.map((d) => d.id),
      };
      if (terceiroId) {
        await updateCadastroTerceiro(terceiroId, payload);
        toast.success("Terceiro atualizado.");
      } else {
        await createCadastroTerceiro(payload);
        toast.success("Terceiro cadastrado.");
      }
      router.push("/cadastros/pessoas/terceiros");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="h-64 animate-pulse rounded-lg border border-border bg-card" />;
  }

  const docCnh = docs.find((d) => d.tipo === "CNH");
  const docCavalo = docs.find((d) => d.tipo === "CRLV_CAVALO");

  return (
    <form onSubmit={handleSubmit} className={CADASTRO_FORM_CLASS}>
      <FormSection
        title="Motorista"
        icon={User}
        action={
          <AnexarBotao
            anexoLabel="CNH"
            doc={docCnh}
            busy={uploading === "CNH"}
            onFile={(f) => void onUpload("CNH", f)}
            onAplicar={aplicar}
          />
        }
      >
        <SugestaoDoc className="mb-4" doc={docCnh} onAplicar={aplicar} />
        <div className="flex flex-wrap gap-4">
          <FormField label="Nome" required className="min-w-[14rem] flex-1">
            <Input
              value={formData.motoristaNome}
              onChange={(e) => {
                const motoristaNome = e.target.value;
                setFormData((prev) => ({
                  ...prev,
                  motoristaNome,
                  donoNome: mesmoDono ? motoristaNome : prev.donoNome,
                }));
              }}
            />
          </FormField>
          <FormField label="CPF" required size="md">
            <Input
              inputMode="numeric"
              placeholder="000.000.000-00"
              value={formatCpfBr(formData.motoristaCpf)}
              onChange={(e) =>
                setFormData({ ...formData, motoristaCpf: e.target.value.replace(/\D/g, "").slice(0, 11) })
              }
              onBlur={(e) => validarCpfCampo(e.target.value)}
            />
          </FormField>
        </div>
        <div className="mt-4 flex flex-wrap gap-4">
          <FormField label="Cat. CNH" size="xs">
            <select
              className={SELECT_CLASS}
              value={formData.cnhCategoria ?? ""}
              onChange={(e) => setFormData({ ...formData, cnhCategoria: e.target.value })}
            >
              <option value="">—</option>
              {CNH_CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Validade" size="md">
            <Input
              type="date"
              value={formData.cnhValidade ?? ""}
              onChange={(e) => setFormData({ ...formData, cnhValidade: e.target.value })}
            />
          </FormField>
          <FormField label="WhatsApp" size="md">
            <Input
              inputMode="tel"
              placeholder="(47) 99999-0000"
              value={formatPhoneBr(formData.whatsapp ?? "")}
              onChange={(e) =>
                setFormData({ ...formData, whatsapp: e.target.value.replace(/\D/g, "").slice(0, 11) })
              }
            />
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Dados de pagamento" icon={Banknote}>
        <label className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={mesmoDono}
            onChange={(e) => {
              const checked = e.target.checked;
              setMesmoDono(checked);
              if (checked) {
                setFormData((prev) => ({ ...prev, donoNome: prev.motoristaNome }));
              }
            }}
          />
          Mesmo nome do motorista
        </label>
        <div className="flex flex-wrap gap-4">
          <FormField label="Nome" className="min-w-[14rem] flex-1">
            <Input
              value={formData.donoNome}
              disabled={mesmoDono}
              onChange={(e) => setFormData({ ...formData, donoNome: e.target.value })}
            />
          </FormField>
          <FormField label="PIX" className="min-w-[14rem] flex-1">
            <Input
              placeholder="CPF, e-mail, telefone ou chave aleatória"
              value={formData.pix}
              onChange={(e) => setFormData({ ...formData, pix: e.target.value })}
            />
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Veículo" icon={Truck}>
        <div className="space-y-4">
          <div className="space-y-3 rounded-md border border-border/60 p-3">
            <FormField label="Cavalo (tração)" required size="sm">
              <CampoComAnexo
                anexoLabel="CRLV"
                doc={docCavalo}
                busy={uploading === "CRLV_CAVALO"}
                onFile={(f) => void onUpload("CRLV_CAVALO", f)}
                onAplicar={aplicar}
              >
                <Input
                  className="uppercase"
                  maxLength={8}
                  placeholder="ABC1D23"
                  value={formData.placaCavalo}
                  onChange={(e) =>
                    setFormData({ ...formData, placaCavalo: normalizePlacaInput(e.target.value) })
                  }
                  onBlur={(e) => validarPlacaCampo(e.target.value, "Cavalo")}
                />
              </CampoComAnexo>
            </FormField>
            <div className="flex flex-wrap gap-4">
              <FormField label="Renavam" size="md">
                <Input
                  inputMode="numeric"
                  maxLength={11}
                  placeholder="Somente números"
                  value={formData.renavamCavalo ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      renavamCavalo: e.target.value.replace(/\D/g, "").slice(0, 11),
                    })
                  }
                />
              </FormField>
              <FormField label="Validade do documento">
                <Input
                  type="date"
                  value={formData.crlvValidadeCavalo ?? ""}
                  onChange={(e) => setFormData({ ...formData, crlvValidadeCavalo: e.target.value })}
                />
              </FormField>
            </div>
          </div>

          {carretas.map((carreta, index) => {
            const doc = docCarretaNoIndice(docs, index);
            return (
              <div key={index} className="space-y-3 rounded-md border border-border/60 p-3">
                <div className="flex items-start justify-between gap-2">
                  <FormField className="min-w-0 flex-1" label={index === 0 ? "Carreta" : `Carreta ${index + 1}`} size="sm">
                    <CampoComAnexo
                      anexoLabel="CRLV"
                      doc={doc}
                      busy={uploading === `carreta-${index}`}
                      onFile={(f) => void onUpload("CRLV_CARRETA", f, index)}
                      onAplicar={aplicar}
                    >
                      <Input
                        className="uppercase"
                        maxLength={8}
                        placeholder="ABC1D23"
                        value={carreta.placa}
                        onChange={(e) => patchCarreta(index, { placa: normalizePlacaInput(e.target.value) })}
                        onBlur={(e) =>
                          validarPlacaCampo(e.target.value, index === 0 ? "Carreta" : `Carreta ${index + 1}`)
                        }
                      />
                    </CampoComAnexo>
                  </FormField>
                  {carretas.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="mt-6 h-10 w-10 shrink-0 text-destructive"
                      aria-label={`Remover carreta ${index + 1}`}
                      onClick={() => removeCarreta(index)}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-4">
                  <FormField label="Capacidade (pinos)" className="min-w-[14rem] flex-1">
                    <div className="flex min-h-10 flex-wrap items-center gap-3">
                      {pinosCatalogo.map((tam) => (
                        <label key={tam} className="flex cursor-pointer items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={tamanhoContainerSelecionado(carreta.pinos, tam)}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? normalizeTamanhosContainer([...carreta.pinos, tam])
                                : normalizeTamanhosContainer(
                                    carreta.pinos.filter((t) => normalizeTamanhoContainer(t) !== tam),
                                  );
                              patchCarreta(index, { pinos: next });
                            }}
                            className="h-4 w-4 rounded border-border"
                          />
                          {formatTamanhoContainerDisplay(tam)}
                        </label>
                      ))}
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Tamanhos do cadastro Tipos de contêiner
                    </p>
                  </FormField>
                  <FormField label="Renavam" size="md">
                    <Input
                      inputMode="numeric"
                      maxLength={11}
                      placeholder="Somente números"
                      value={carreta.renavam}
                      onChange={(e) =>
                        patchCarreta(index, { renavam: e.target.value.replace(/\D/g, "").slice(0, 11) })
                      }
                    />
                  </FormField>
                  <FormField label="Validade do documento" size="md">
                    <Input
                      type="date"
                      value={carreta.validadeDocumento}
                      onChange={(e) => patchCarreta(index, { validadeDocumento: e.target.value })}
                    />
                  </FormField>
                </div>
              </div>
            );
          })}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setCarretas((prev) => (prev.length >= 12 ? prev : [...prev, emptyCarreta(pinosCatalogo)]))
            }
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Adicionar carreta
          </Button>
        </div>
      </FormSection>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/cadastros/pessoas/terceiros")}
        >
          <X className="mr-2 h-4 w-4" />
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? null : <Save className="mr-2 h-4 w-4" />}
          {terceiroId ? "Salvar" : "Cadastrar"}
        </Button>
      </div>
    </form>
  );
}

function AnexarBotao({
  doc,
  busy,
  onFile,
  onAplicar,
  anexoLabel = "Anexar",
}: {
  doc?: CadastroTerceiroDocumento;
  busy: boolean;
  onFile: (file: File | undefined) => void;
  onAplicar: (doc: CadastroTerceiroDocumento) => void;
  anexoLabel?: string;
}) {
  return (
    <label className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md border border-border bg-background px-2 text-xs text-muted-foreground hover:bg-muted/40">
      <input
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        className="hidden"
        disabled={busy}
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <FileUp className="h-3.5 w-3.5" />
      {busy ? "Lendo…" : doc ? "Trocar" : anexoLabel}
    </label>
  );
}

function SugestaoDoc({
  doc,
  onAplicar,
  className,
}: {
  doc?: CadastroTerceiroDocumento;
  onAplicar: (doc: CadastroTerceiroDocumento) => void;
  className?: string;
}) {
  if (!doc) return null;
  const s = doc.sugestoes ?? doc.extraido;
  const resumo = s
    ? [s.nome, s.cpf, s.cnhCategoria, s.cnhValidade, s.placa, s.renavam, s.crlvValidade, s.donoNome]
        .filter(Boolean)
        .join(" · ")
    : "";
  return (
    <div className={cn("mt-1.5 space-y-1 text-xs text-muted-foreground", className)}>
      <p>
        {doc.originalName}{" "}
        <a
          href={urlArquivoDocumentoTerceiro(doc.id)}
          target="_blank"
          rel="noreferrer"
          className="text-[var(--accent)] underline"
        >
          ver
        </a>
      </p>
      {resumo ? (
        <div className="flex flex-wrap items-center gap-2">
          <span>Sugestão: {resumo}</span>
          <Button type="button" size="sm" variant="outline" className="h-7 px-2" onClick={() => onAplicar(doc)}>
            Aplicar
          </Button>
        </div>
      ) : (
        <p>Nada extraído — preencha à mão.</p>
      )}
    </div>
  );
}

function CampoComAnexo({
  children,
  doc,
  busy,
  onFile,
  onAplicar,
  className,
  anexoLabel = "Anexar",
}: {
  children: ReactNode;
  doc?: CadastroTerceiroDocumento;
  busy: boolean;
  onFile: (file: File | undefined) => void;
  onAplicar: (doc: CadastroTerceiroDocumento) => void;
  className?: string;
  anexoLabel?: string;
}) {
  return (
    <div className={className}>
      <div className="flex w-full items-center gap-3">
        <div className="min-w-0 max-w-[90%] flex-1">{children}</div>
        <div className="ml-auto shrink-0">
          <AnexarBotao anexoLabel={anexoLabel} doc={doc} busy={busy} onFile={onFile} onAplicar={onAplicar} />
        </div>
      </div>
      <SugestaoDoc doc={doc} onAplicar={onAplicar} />
    </div>
  );
}
