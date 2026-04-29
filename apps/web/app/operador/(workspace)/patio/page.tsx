"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ApiError, staffJson } from "@/lib/api/staff-client";
import { toast } from "@/lib/toast";
import { YardGrid, type YardBucket } from "@/components/operador/yard-grid";
import { MovimentacaoModal } from "@/components/operador/movimentacao-modal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useStaffAuthStore } from "@/stores/staff-auth-store";

const QUADRAS = ["A1", "A2", "A3", "B1", "B2", "B3"];
const CAP = 20;

type FilaItem = {
  solicitacaoId: string;
  protocolo: string;
  ordenadoPor: string;
  quantidadeUnidades: number;
  quadra?: string;
};

export default function PatioPage() {
  const role = useStaffAuthStore((s) => s.user?.role ?? "");
  const podeSaida = ["ADMIN", "GERENTE", "OPERADOR_GATE"].includes(role);

  const [fila, setFila] = useState<FilaItem[]>([]);
  const [approved, setApproved] = useState<{ id: string; protocolo: string }[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [moveId, setMoveId] = useState<string | null>(null);
  const [quadFocus, setQuadFocus] = useState(QUADRAS[0]);

  const load = useCallback(async () => {
    try {
      const dash = await staffJson<{
        filas?: { filaPatio?: FilaItem[] };
      }>(`/dashboard`);
      setFila(dash.filas?.filaPatio ?? []);
      const r = await staffJson<{ items: { id: string; protocolo: string }[] }>(
        `/solicitacoes?status=APROVADO&limit=100&page=1`,
      );
      setApproved(r.items ?? []);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Erro ao carregar pátio");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const buckets: YardBucket[] = useMemo(() => {
    const map = new Map<string, FilaItem[]>();
    for (const q of QUADRAS) map.set(q, []);
    for (const it of fila) {
      const q = it.quadra && QUADRAS.includes(it.quadra) ? it.quadra : "A1";
      if (!map.has(q)) map.set(q, []);
      map.get(q)!.push(it);
    }
    return QUADRAS.map((codigo) => ({
      codigo,
      items: (map.get(codigo) ?? []).map((it) => ({
        solicitacaoId: it.solicitacaoId,
        protocolo: it.protocolo,
        n: it.quantidadeUnidades,
      })),
    }));
  }, [fila]);

  const itemsLateral: FilaItem[] = fila.length
    ? fila
    : approved.map((a) => ({
        solicitacaoId: a.id,
        protocolo: a.protocolo,
        ordenadoPor: "",
        quantidadeUnidades: 0,
      }));

  async function registrarSaida(sid: string) {
    try {
      await staffJson(`/solicitacoes/saida`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ solicitacaoId: sid, dataHoraSaida: new Date().toISOString() }),
      });
      toast.success("Saída registrada");
      void load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha saída");
    }
  }

  async function movimentar(destQuadra: string, fileira: string, posicao: string, _obs: string) {
    if (!moveId) return;
    void _obs;
    try {
      await staffJson(`/solicitacoes/patio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          solicitacaoId: moveId,
          quadra: destQuadra,
          fileira,
          posicao,
        }),
      });
      toast.success("Movimentação registrada");
      void load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Conflito de posição ou erro");
    }
  }

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <h1 className="text-2xl font-bold text-white">Operador · Pátio</h1>
      <p className="text-sm text-slate-500">
        Mapa lógico a partir de GET /dashboard (fila pátio) e GET /solicitacoes?status=APROVADO.
      </p>

      <YardGrid
        buckets={buckets}
        capPerQuad={CAP}
        onSelectQuadra={(c) => {
          setQuadFocus(c);
        }}
      />

      <Card className="border-white/10 bg-[#0c0f14]">
        <CardHeader>
          <CardTitle className="text-white">
            Quadra {quadFocus} — unidades ({buckets.find((b) => b.codigo === quadFocus)?.items.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(buckets.find((b) => b.codigo === quadFocus)?.items ?? []).map((it) => (
            <div
              key={it.solicitacaoId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-3"
            >
              <div>
                <p className="font-mono text-white">{it.protocolo}</p>
                <p className="text-xs text-slate-500">{it.n} un.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" asChild>
                  <Link href={`/operador/patio/${it.solicitacaoId}`}>Detalhes</Link>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setMoveId(it.solicitacaoId);
                    setModalOpen(true);
                  }}
                >
                  Movimentar
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-[#0c0f14]">
        <CardHeader>
          <CardTitle className="text-white">Todas as unidades ativas (fila)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {itemsLateral.map((it) => (
            <div
              key={it.solicitacaoId}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 py-3 last:border-0"
            >
              <div>
                <p className="font-mono text-white">{it.protocolo}</p>
                <p className="text-xs text-slate-500">
                  Quadra: {it.quadra ?? "—"} · {it.quantidadeUnidades ?? 0} un.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" asChild>
                  <Link href={`/operador/patio/${it.solicitacaoId}`}>Abrir</Link>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setMoveId(it.solicitacaoId);
                    setModalOpen(true);
                  }}
                >
                  Movimentar
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {podeSaida && fila.length > 0 ? (
        <Card className="border-white/10 bg-[#0c0f14]">
          <CardHeader>
            <CardTitle className="text-white">Registrar saída (rápido)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-slate-500">
              POST /solicitacoes/saida — disponível para perfis com permissão de saída.
            </p>
            {fila.slice(0, 8).map((it) => (
              <div key={it.solicitacaoId} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="font-mono text-slate-200">{it.protocolo}</span>
                <Button type="button" className="min-h-12 shrink-0" onClick={() => void registrarSaida(it.solicitacaoId)}>
                  Registrar saída
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <MovimentacaoModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        quadrasDestino={QUADRAS}
        defaultQuadra={quadFocus}
        onSubmit={(d, f, p, o) => void movimentar(d, f, p, o)}
      />
    </main>
  );
}
