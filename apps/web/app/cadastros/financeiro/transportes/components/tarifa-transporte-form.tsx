"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Route, Save, X } from "lucide-react";
import { FormField, FormSection, CADASTRO_FORM_CLASS } from "@/components/cadastros/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/staff-client";
import { listCadastrosLocaisTransporte } from "@/lib/api/cadastros-locais-transporte-client";
import { listCadastrosTiposContainer } from "@/lib/api/cadastros-tipos-container-client";
import {
  createCadastroTarifaTransporte,
  getCadastroTarifaTransporte,
  updateCadastroTarifaTransporte,
} from "@/lib/api/cadastros-tarifas-transporte-client";
import { formatBRL, formatContabil, parseMoeda } from "@/lib/financeiro/format";
import { MoneyInput } from "@/components/ui/money-input";
import { toast } from "@/lib/toast";

const SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm";

const FATOR_RETORNO = 0.5;

type Props = { tabelaId: string; tarifaId?: string; duplicarId?: string };

export function TarifaTransporteForm({ tabelaId, tarifaId, duplicarId }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [origemId, setOrigemId] = useState("");
  const [destinoId, setDestinoId] = useState("");
  const [statusCarga, setStatusCarga] = useState<"CHEIO" | "VAZIO">("CHEIO");
  const [tipoContainerCodigos, setTipoContainerCodigos] = useState<string[]>([]);
  const [retorno, setRetorno] = useState(false);
  const [valor, setValor] = useState("");
  const [valorPagoTerceiro, setValorPagoTerceiro] = useState("");
  const [observacao, setObservacao] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [locais, setLocais] = useState<{ id: string; nome: string; codigo: string; ativo: boolean }[]>(
    [],
  );
  const [tipos, setTipos] = useState<{ codigo: string; nome: string; ativo: boolean }[]>([]);

  useEffect(() => {
    let on = true;
    void (async () => {
      try {
        const [catalogo, tiposRes] = await Promise.all([
          listCadastrosLocaisTransporte(),
          listCadastrosTiposContainer(),
        ]);
        if (!on) return;
        setLocais(catalogo.items);
        setTipos(tiposRes.items);
        const origemFormulario = tarifaId ?? duplicarId;
        if (origemFormulario) {
          const data = await getCadastroTarifaTransporte(origemFormulario);
          if (!on) return;
          setOrigemId(data.origemId);
          setDestinoId(data.destinoId);
          setStatusCarga(data.statusCarga === "VAZIO" ? "VAZIO" : "CHEIO");
          setTipoContainerCodigos(
            data.tipoContainerCodigo ? [data.tipoContainerCodigo] : [],
          );
          setRetorno(data.retorno);
          setValor(formatContabil(data.valor));
          setValorPagoTerceiro(
            data.valorPagoTerceiro != null ? formatContabil(data.valorPagoTerceiro) : "",
          );
          setObservacao(data.observacao ?? "");
          setAtivo(tarifaId ? data.ativo : true);
        }
      } catch {
        toast.error("Erro ao carregar tarifa de transporte.");
      } finally {
        if (on) setLoading(false);
      }
    })();
    return () => {
      on = false;
    };
  }, [tarifaId, duplicarId]);

  const locaisAtivos = useMemo(
    () => locais.filter((l) => l.ativo || l.id === origemId || l.id === destinoId),
    [locais, origemId, destinoId],
  );

  const tiposOpcoes = useMemo(
    () => tipos.filter((t) => t.ativo || tipoContainerCodigos.includes(t.codigo)),
    [tipos, tipoContainerCodigos],
  );

  function toggleTipo(codigo: string) {
    setTipoContainerCodigos((atuais) =>
      atuais.includes(codigo) ? atuais.filter((c) => c !== codigo) : [...atuais, codigo],
    );
  }

  function marcarTodosMenosIsotank() {
    setTipoContainerCodigos(
      tiposOpcoes.filter((t) => t.codigo.toUpperCase() !== "ISOTANK").map((t) => t.codigo),
    );
  }

  const valorTabela = parseMoeda(valor);
  const valorCobrado =
    Number.isFinite(valorTabela) ? Math.round(valorTabela * (retorno ? FATOR_RETORNO : 1) * 100) / 100 : null;
  const terceiroTabela = parseMoeda(valorPagoTerceiro);
  const terceiroEfetivo =
    valorPagoTerceiro.trim() && Number.isFinite(terceiroTabela)
      ? Math.round(terceiroTabela * (retorno ? FATOR_RETORNO : 1) * 100) / 100
      : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!origemId || !destinoId) {
      toast.error("Selecione origem e destino.");
      return;
    }
    if (origemId === destinoId) {
      toast.error("Origem e destino precisam ser locais diferentes.");
      return;
    }
    if (!tipoContainerCodigos.length) {
      toast.error("Selecione ao menos um tipo de contêiner.");
      return;
    }
    if (!Number.isFinite(valorTabela) || valorTabela < 0) {
      toast.error("Informe um valor válido.");
      return;
    }
    const terceiroRaw = valorPagoTerceiro.trim();
    const terceiroNum = terceiroRaw ? parseMoeda(terceiroRaw) : null;
    if (terceiroRaw && (!Number.isFinite(terceiroNum) || (terceiroNum ?? 0) < 0)) {
      toast.error("Informe um valor pago ao terceiro válido.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        tabelaId,
        origemId,
        destinoId,
        statusCarga,
        tipoContainerCodigos,
        retorno,
        valor: valorTabela,
        valorPagoTerceiro: terceiroNum,
        observacao: observacao.trim() || null,
        ativo,
      };
      if (tarifaId) {
        await updateCadastroTarifaTransporte(tarifaId, payload);
        toast.success(
          tipoContainerCodigos.length > 1
            ? `Tarifa aplicada a ${tipoContainerCodigos.length} tipos.`
            : "Tarifa atualizada.",
        );
      } else {
        const created = await createCadastroTarifaTransporte(payload);
        const n = created.criados ?? tipoContainerCodigos.length;
        toast.success(n > 1 ? `${n} trechos cadastrados com o mesmo valor.` : "Tarifa cadastrada.");
      }
      router.push(`/cadastros/financeiro/transportes/${tabelaId}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="h-64 animate-pulse rounded-lg border border-border bg-card" />;
  }

  return (
    <form onSubmit={handleSubmit} className={CADASTRO_FORM_CLASS}>
      <div>
        <h1 className="text-2xl font-bold">
          {tarifaId ? "Editar trecho" : duplicarId ? "Novo trecho (cópia)" : "Novo trecho"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {duplicarId
            ? "Marque os tipos que compartilham o valor. IsoTank costuma ficar de fora."
            : "Trecho bidirecional. Marque os tipos com o mesmo valor; IsoTank em geral tem tarifa própria. Retorno cobra 50%."}
        </p>
      </div>

      {locaisAtivos.length < 2 ? (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          Cadastre ao menos dois locais em{" "}
          <Link href="/cadastros/operacional/origens-destinos" className="underline">
            Origens e destinos
          </Link>{" "}
          antes de criar a tarifa.
        </p>
      ) : null}

      <FormSection title="Trecho" icon={Route}>
        <div className="flex flex-wrap gap-4">
          <FormField label="Ponto A" required className="min-w-[14rem] flex-1">
            <select
              value={origemId}
              onChange={(e) => setOrigemId(e.target.value)}
              className={SELECT_CLASS}
            >
              <option value="">Selecione</option>
              {locaisAtivos.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nome} ({l.codigo})
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Ponto B" required className="min-w-[14rem] flex-1">
            <select
              value={destinoId}
              onChange={(e) => setDestinoId(e.target.value)}
              className={SELECT_CLASS}
            >
              <option value="">Selecione</option>
              {locaisAtivos.map((l) => (
                <option key={l.id} value={l.id} disabled={l.id === origemId}>
                  {l.nome} ({l.codigo})
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Carga" required size="sm">
            <select
              value={statusCarga}
              onChange={(e) => setStatusCarga(e.target.value as "CHEIO" | "VAZIO")}
              className={SELECT_CLASS}
            >
              <option value="CHEIO">Cheio</option>
              <option value="VAZIO">Vazio</option>
            </select>
          </FormField>
          <FormField label="Tipo de contêiner" required className="min-w-[16rem] w-full">
            <div className="rounded-md border border-border p-3">
              <div className="mb-2 flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={marcarTodosMenosIsotank}>
                  Todos, menos IsoTank
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setTipoContainerCodigos([])}
                >
                  Limpar
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {tiposOpcoes.map((t) => (
                  <label key={t.codigo} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={tipoContainerCodigos.includes(t.codigo)}
                      onChange={() => toggleTipo(t.codigo)}
                      className="h-4 w-4 rounded border-border"
                    />
                    <span>
                      {t.nome}{" "}
                      <span className="font-mono text-xs text-muted-foreground">({t.codigo})</span>
                    </span>
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Cada tipo marcado vira um trecho na lista, todos com o mesmo valor.
              </p>
            </div>
          </FormField>
          <FormField label="Valor da tarifa" required>
            <MoneyInput value={valor} onChange={setValor} />
            {retorno && valorCobrado != null ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Retorno: cobrado {formatBRL(valorCobrado)} (50% da tarifa)
              </p>
            ) : null}
          </FormField>
          <FormField label="Valor pago ao terceiro">
            <MoneyInput
              value={valorPagoTerceiro}
              onChange={setValorPagoTerceiro}
              placeholder="Valor de ida (opcional)"
            />
            {retorno && terceiroEfetivo != null ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Retorno: pago {formatBRL(terceiroEfetivo)} (50% do terceiro)
              </p>
            ) : null}
          </FormField>
          <FormField label="Observação" className="min-w-[16rem] flex-[2]">
            <Input
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Opcional"
              maxLength={500}
            />
          </FormField>
        </div>

        <div className="mt-4 space-y-3">
          <label className="flex cursor-pointer items-start gap-2">
            <input
              type="checkbox"
              checked={retorno}
              onChange={(e) => setRetorno(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border"
            />
            <span className="text-sm">
              Frete de retorno
              <span className="mt-0.5 block text-xs text-muted-foreground">
                O valor cobrado ao cliente e o pago ao terceiro ficam em 50% da tarifa de ida.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={ativo}
              onChange={(e) => setAtivo(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <span className="text-sm">Tarifa ativa</span>
          </label>
        </div>
      </FormSection>

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          <X className="mr-2 h-4 w-4" />
          Cancelar
        </Button>
        <Button
          type="submit"
          variant="default"
          disabled={
            saving ||
            locaisAtivos.length < 2 ||
            tiposOpcoes.length === 0 ||
            tipoContainerCodigos.length === 0
          }
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              {tarifaId ? "Atualizar" : "Cadastrar"}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
