"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { PatioGradeOrientacao } from "@/components/patio/patio-grade-orientacao";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWidgetData, WidgetError } from "@/components/ui/widget-error";
import { ApiError } from "@/lib/api/staff-client";
import {
  createCadastroZonaPatio,
  deleteCadastroZonaPatio,
  listCadastrosPosicoesPatio,
  listCadastrosPosicoesPatioZonas,
  updateCadastroZonaPatio,
  type CadastroPosicaoPatio,
  type CadastroPosicaoPatioZona,
} from "@/lib/api/cadastros-posicoes-patio-client";
import { canDo } from "@/lib/cadastros/permission-matrix";
import {
  parsePatioZonaPosicao,
  posicaoCadastro,
  posicoesOrdemVisual,
  rotuloPosicaoPatio,
} from "@/lib/patio/patio-posicao";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

function LoadingSkeleton() {
  return <div className="h-64 animate-pulse rounded-lg border border-border bg-card" />;
}

function ocupada(pos?: CadastroPosicaoPatio | null) {
  if (!pos) return false;
  return pos.status === "OCUPADO" || pos.status === "BLOQUEADO" || pos.status === "RESERVADO";
}

export default function PosicoesPatioPage() {
  const router = useRouter();
  const staffUser = useStaffAuthStore((s) => s.user);
  const user = { id: staffUser?.id, role: staffUser?.role ?? "", permissions: staffUser?.permissions };
  const [zonaCodigoSel, setZonaCodigoSel] = useState("");
  const [modoZona, setModoZona] = useState<"fechado" | "cadastrar" | "editar">("fechado");
  const [zonaCodigo, setZonaCodigo] = useState("");
  const [zonaNome, setZonaNome] = useState("");
  const [quantidadePosicoes, setQuantidadePosicoes] = useState(12);
  const [salvandoZona, setSalvandoZona] = useState(false);
  const [excluindoZona, setExcluindoZona] = useState(false);

  const { data, loading, error, refetch } = useWidgetData(() => listCadastrosPosicoesPatio(), []);
  const { data: zonasData, refetch: refetchZonas } = useWidgetData(
    () => listCadastrosPosicoesPatioZonas(),
    [],
  );
  const canCreate = canDo(user, "operacional", "CREATE");
  const canEdit = canDo(user, "operacional", "EDIT");
  const canDelete = canEdit || canDo(user, "operacional", "DELETE");

  const zonas = zonasData?.items ?? [];
  const zonaAtual = zonas.find((z) => z.codigo === zonaCodigoSel) ?? zonas[0] ?? null;

  useEffect(() => {
    if (!zonaCodigoSel && zonas[0]) setZonaCodigoSel(zonas[0].codigo);
  }, [zonas, zonaCodigoSel]);

  const atuais = useMemo(() => {
    return (data?.items ?? []).filter((p) => parsePatioZonaPosicao(p.codigo));
  }, [data?.items]);

  const grade = useMemo(() => {
    const codigo = zonaAtual?.codigo ?? "";
    return posicoesOrdemVisual().map((n) => {
      const item =
        atuais.find((p) => p.zonaCodigo === codigo && posicaoCadastro(p) === n) ?? null;
      return { posicao: n, item };
    });
  }, [atuais, zonaAtual?.codigo]);

  function abrirCadastrar() {
    setModoZona("cadastrar");
    setZonaCodigo("");
    setZonaNome("");
    setQuantidadePosicoes(12);
  }

  function abrirEditar(z: CadastroPosicaoPatioZona) {
    setZonaCodigoSel(z.codigo);
    setModoZona("editar");
    setZonaCodigo(z.codigo);
    setZonaNome(z.nome);
    const ja = (data?.items ?? []).filter((p) => p.zonaCodigo === z.codigo && parsePatioZonaPosicao(p.codigo)).length;
    setQuantidadePosicoes(ja > 0 ? ja : 12);
  }

  async function salvarZona(e: React.FormEvent) {
    e.preventDefault();
    if (!zonaCodigo.trim()) {
      toast.error("Informe o código da zona (ex.: A1, A2, B7).");
      return;
    }
    setSalvandoZona(true);
    try {
      if (modoZona === "editar" && zonaAtual) {
        const r = await updateCadastroZonaPatio(zonaAtual.id, {
          codigo: zonaCodigo,
          nome: zonaNome || undefined,
          quantidadePosicoes,
        });
        toast.success(
          r.criadas
            ? `Zona ${r.zona.codigo} salva. ${r.criadas} posição(ões) criadas.`
            : `Zona ${r.zona.codigo} salva.`,
        );
        setZonaCodigoSel(r.zona.codigo);
      } else {
        const r = await createCadastroZonaPatio({
          codigo: zonaCodigo,
          nome: zonaNome || undefined,
          quantidadePosicoes,
        });
        toast.success(
          r.criadas
            ? `Zona ${r.zona.codigo} cadastrada com ${r.criadas} posição(ões).`
            : `Zona ${r.zona.codigo} cadastrada.`,
        );
        setZonaCodigoSel(r.zona.codigo);
      }
      setModoZona("fechado");
      refetch();
      refetchZonas();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível salvar a zona.");
    } finally {
      setSalvandoZona(false);
    }
  }

  async function excluirZona() {
    if (!zonaAtual) return;
    if (!window.confirm(`Excluir a zona ${zonaAtual.codigo} e as posições dela?`)) return;
    setExcluindoZona(true);
    try {
      await deleteCadastroZonaPatio(zonaAtual.id);
      toast.success(`Zona ${zonaAtual.codigo} excluída.`);
      setModoZona("fechado");
      refetch();
      refetchZonas();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível excluir a zona.");
    } finally {
      setExcluindoZona(false);
    }
  }

  function abrirSlot(posicao: number, item: CadastroPosicaoPatio | null) {
    const zona = zonaAtual?.codigo;
    if (!zona) return;
    if (item && canEdit) {
      router.push(`/cadastros/operacional/posicoes-patio/${item.id}`);
      return;
    }
    if (!item && canCreate) {
      router.push(`/cadastros/operacional/posicoes-patio/novo?zona=${zona}&posicao=${posicao}`);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Posições de Pátio</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Cadastre zonas (A1, A2, B7…) e quantas posições quiser na grade (até 12). O 01 fica
            embaixo à esquerda; o 02 sobe na mesma coluna.
          </p>
        </div>
        {canCreate ? (
          <Button size="sm" onClick={abrirCadastrar}>
            <Plus className="mr-2 h-4 w-4" />
            Cadastrar
          </Button>
        ) : null}
      </div>

      {loading ? <LoadingSkeleton /> : null}
      {!loading && error ? (
        <WidgetError title="Não foi possível carregar posições de pátio" onRetry={refetch} />
      ) : null}

      {!loading && !error ? (
        <div className="space-y-5 rounded-lg border border-border bg-card p-5">
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Zona</p>
              <div className="flex flex-wrap gap-2">
                {canCreate ? (
                  <Button size="sm" variant="outline" onClick={abrirCadastrar}>
                    <Plus className="mr-2 h-4 w-4" />
                    Cadastrar
                  </Button>
                ) : null}
                {canEdit && zonaAtual ? (
                  <Button size="sm" variant="outline" onClick={() => abrirEditar(zonaAtual)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Editar
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {zonas.map((z) => (
                <button
                  key={z.id}
                  type="button"
                  onClick={() => {
                    setZonaCodigoSel(z.codigo);
                    if (modoZona === "editar") {
                      setZonaCodigo(z.codigo);
                      setZonaNome(z.nome);
                    }
                  }}
                  className={cn(
                    "min-h-12 min-w-12 rounded-xl border px-4 text-lg font-bold",
                    zonaAtual?.codigo === z.codigo
                      ? "border-cyan-400 bg-cyan-400 text-zinc-950"
                      : "border-border bg-background text-foreground hover:bg-muted/40",
                  )}
                >
                  {z.codigo}
                </button>
              ))}
              {zonas.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma zona. Clique em Cadastrar.</p>
              ) : null}
            </div>

            {modoZona !== "fechado" ? (
              <form
                onSubmit={(e) => void salvarZona(e)}
                className="mt-4 space-y-3 rounded-lg border border-border bg-background/40 p-4"
              >
                <p className="text-sm font-semibold">
                  {modoZona === "editar" ? "Editar zona" : "Cadastrar zona"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Código, nome e quantas posições entram na grade. Se a zona já existir, o
                  salvar atualiza em vez de duplicar.
                </p>
                <div className="flex flex-wrap gap-3">
                  <div className="w-32">
                    <label className="mb-1 block text-xs text-muted-foreground">Código</label>
                    <Input
                      value={zonaCodigo}
                      onChange={(e) => setZonaCodigo(e.target.value.toUpperCase().slice(0, 16))}
                      placeholder="A1"
                      className="font-mono"
                      required
                    />
                  </div>
                  <div className="min-w-[12rem] flex-1">
                    <label className="mb-1 block text-xs text-muted-foreground">Nome</label>
                    <Input
                      value={zonaNome}
                      onChange={(e) => setZonaNome(e.target.value)}
                      placeholder="Zona A1"
                    />
                  </div>
                </div>
                <div className="w-40">
                  <label className="mb-1 block text-xs text-muted-foreground">
                    Posições na grade
                  </label>
                  <Input
                    type="number"
                    min={0}
                    max={12}
                    value={quantidadePosicoes}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (!Number.isFinite(n)) {
                        setQuantidadePosicoes(0);
                        return;
                      }
                      setQuantidadePosicoes(Math.min(12, Math.max(0, Math.floor(n))));
                    }}
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    0 a 12. 01 embaixo à esquerda, sobe a coluna e segue à direita.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" size="sm" disabled={salvandoZona}>
                    {salvandoZona ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Salvar
                  </Button>
                  {modoZona === "editar" && canDelete ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-red-400 hover:text-red-300"
                      disabled={excluindoZona}
                      onClick={() => void excluirZona()}
                    >
                      {excluindoZona ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="mr-2 h-4 w-4" />
                      )}
                      Excluir
                    </Button>
                  ) : null}
                  <Button type="button" variant="outline" size="sm" onClick={() => setModoZona("fechado")}>
                    Cancelar
                  </Button>
                </div>
              </form>
            ) : null}
          </div>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Posições {zonaAtual ? `da zona ${zonaAtual.codigo}` : ""}
            </p>
            <PatioGradeOrientacao className="mx-auto w-full max-w-md">
              <div className="grid grid-cols-4 gap-3">
                {grade.map(({ posicao, item }) => {
                  const marcada = ocupada(item);
                  const vazia = !item;
                  return (
                    <button
                      key={`${zonaAtual?.codigo ?? "x"}-${posicao}`}
                      type="button"
                      onClick={() => abrirSlot(posicao, item)}
                      className={cn(
                        "flex aspect-square items-center justify-center rounded-md border-2 bg-transparent font-mono text-sm",
                        vazia
                          ? "border-dashed border-muted-foreground/40 text-muted-foreground"
                          : marcada
                            ? "border-red-500 text-red-300"
                            : "border-emerald-500 text-emerald-300",
                      )}
                      aria-label={`Zona ${zonaAtual?.codigo ?? ""} posição ${rotuloPosicaoPatio(posicao)}${vazia ? " não cadastrada" : marcada ? " ocupada" : " livre"}`}
                    >
                      {rotuloPosicaoPatio(posicao)}
                    </button>
                  );
                })}
              </div>
            </PatioGradeOrientacao>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              01 embaixo à esquerda · 02 acima. Clique no quadrado para cadastrar ou editar a posição.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
