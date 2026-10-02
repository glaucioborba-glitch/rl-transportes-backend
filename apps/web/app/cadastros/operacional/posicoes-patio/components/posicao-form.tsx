"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Save, Trash2, X } from "lucide-react";
import { CADASTRO_FORM_CLASS } from "@/components/cadastros/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/staff-client";
import {
  createCadastroPosicaoPatio,
  deleteCadastroPosicaoPatio,
  getCadastroPosicaoPatio,
  updateCadastroPosicaoPatio,
} from "@/lib/api/cadastros-posicoes-patio-client";
import {
  PATIO_POSICOES_POR_ZONA,
  codigoPatioZonaPosicao,
  posicaoCadastro,
  rotuloPosicaoPatio,
} from "@/lib/patio/patio-posicao";
import { toast } from "@/lib/toast";

const selectClass =
  "flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm";

type Props = { posicaoId?: string };

export function PosicaoForm({ posicaoId }: Props) {
  return (
    <Suspense
      fallback={
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Carregando…
        </div>
      }
    >
      <PosicaoFormInner posicaoId={posicaoId} />
    </Suspense>
  );
}

function PosicaoFormInner({ posicaoId }: Props) {
  const router = useRouter();
  const search = useSearchParams();
  const zonaInicial = (search.get("zona") ?? "").toUpperCase();
  const posicaoInicial = Number(search.get("posicao") ?? "");
  const [saving, setSaving] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [loading, setLoading] = useState(Boolean(posicaoId));
  const [zonaCodigo, setZonaCodigo] = useState(zonaInicial);
  const [zonaNome, setZonaNome] = useState(zonaInicial ? `Zona ${zonaInicial}` : "");
  const [posicao, setPosicao] = useState(
    Number.isInteger(posicaoInicial) &&
      posicaoInicial >= 1 &&
      posicaoInicial <= PATIO_POSICOES_POR_ZONA
      ? posicaoInicial
      : 1,
  );
  const [status, setStatus] = useState("LIVRE");

  useEffect(() => {
    if (!posicaoId) return;
    let on = true;
    void (async () => {
      try {
        const data = await getCadastroPosicaoPatio(posicaoId);
        if (!on) return;
        setZonaCodigo(data.zonaCodigo || "");
        setZonaNome(data.zonaNome || `Zona ${data.zonaCodigo || ""}`);
        setPosicao(posicaoCadastro(data) ?? data.slotNumero ?? 1);
        setStatus(data.status);
      } catch {
        toast.error("Erro ao carregar posição.");
      } finally {
        if (on) setLoading(false);
      }
    })();
    return () => {
      on = false;
    };
  }, [posicaoId]);

  const codigoGerado = zonaCodigo.trim()
    ? codigoPatioZonaPosicao(zonaCodigo, posicao)
    : "";

  const voltar = () => router.push("/cadastros/operacional/posicoes-patio");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const zonaFinal = zonaCodigo.trim().toUpperCase();
    if (!zonaFinal) {
      toast.error("Informe o código da zona (ex.: A1, A2, B7).");
      return;
    }
    if (!Number.isInteger(posicao) || posicao < 1 || posicao > PATIO_POSICOES_POR_ZONA) {
      toast.error(`Posição deve ser de 1 a ${PATIO_POSICOES_POR_ZONA}.`);
      return;
    }
    setSaving(true);
    const payload = {
      zonaCodigo: zonaFinal,
      zonaNome: zonaNome.trim() || `Zona ${zonaFinal}`,
      posicao,
      status,
      ativo: true,
    };
    try {
      if (posicaoId) {
        await updateCadastroPosicaoPatio(posicaoId, payload);
        toast.success("Posição salva.");
      } else {
        await createCadastroPosicaoPatio(payload);
        toast.success("Posição salva.");
      }
      voltar();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  async function excluir() {
    if (!posicaoId) return;
    if (!window.confirm(`Excluir a posição ${codigoGerado || posicaoId}?`)) return;
    setExcluindo(true);
    try {
      await deleteCadastroPosicaoPatio(posicaoId);
      toast.success("Posição excluída.");
      voltar();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível excluir.");
    } finally {
      setExcluindo(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Carregando…
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className={CADASTRO_FORM_CLASS}>
      <div>
        <h1 className="text-2xl font-bold">{posicaoId ? "Editar posição" : "Cadastrar posição"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Código da zona, nome e o número da posição na grade (1 a 12). O 01 fica embaixo à
          esquerda.
        </p>
      </div>

      <div className="space-y-3 rounded-lg border border-border bg-card p-4">
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
        <div className="flex flex-wrap gap-3">
          <div className="w-40">
            <label className="mb-1 block text-xs text-muted-foreground">Posição na grade</label>
            <Input
              type="number"
              min={1}
              max={PATIO_POSICOES_POR_ZONA}
              value={posicao}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (!Number.isFinite(n)) {
                  setPosicao(1);
                  return;
                }
                setPosicao(Math.min(PATIO_POSICOES_POR_ZONA, Math.max(1, Math.floor(n))));
              }}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              1 a 12. 01 embaixo à esquerda, sobe a coluna e segue à direita.
            </p>
          </div>
          <div className="w-40">
            <label className="mb-1 block text-xs text-muted-foreground">Status</label>
            <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="LIVRE">Livre</option>
              <option value="OCUPADO">Ocupado</option>
              <option value="BLOQUEADO">Bloqueado</option>
            </select>
          </div>
        </div>
        {codigoGerado ? (
          <p className="font-mono text-sm text-muted-foreground">
            Código da posição: {codigoGerado} ({rotuloPosicaoPatio(posicao)})
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar
          </Button>
          {posicaoId ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="text-red-400 hover:text-red-300"
              disabled={excluindo}
              onClick={() => void excluir()}
            >
              {excluindo ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Excluir
            </Button>
          ) : null}
          <Button type="button" variant="outline" size="sm" onClick={voltar}>
            <X className="mr-2 h-4 w-4" />
            Cancelar
          </Button>
        </div>
      </div>
    </form>
  );
}
