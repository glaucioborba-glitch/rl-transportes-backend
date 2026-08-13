"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  History,
  Loader2,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/staff-client";
import {
  fetchContainerHistorico,
  type ContainerHistoricoResponse,
} from "@/lib/api/cadastros-container-cache-client";
import {
  formatContainerNumber,
  formatDate,
  formatDateTime,
  isValidISO6346,
  stripContainerISO,
} from "@/lib/cadastros/formatters";
import {
  formatTamanhoContainerDisplay,
  resolveTipoContainerCodigo,
} from "@/lib/cadastros/tipo-container-tamanhos";
import { formatContainerISO } from "@/utils/containerFormatter";

export default function HistoricoContainerPage() {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [resultado, setResultado] = useState<ContainerHistoricoResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  const buscarHistorico = async () => {
    const clean = stripContainerISO(busca);
    if (clean.length < 11) {
      setErro("Digite o número completo do contêiner (4 letras + 7 dígitos).");
      return;
    }
    if (!isValidISO6346(clean)) {
      setErro("Número ISO 6346 inválido — dígito verificador não confere.");
      return;
    }

    setLoading(true);
    setErro("");
    try {
      const data = await fetchContainerHistorico(clean);
      setResultado(data);
    } catch (e) {
      setResultado(null);
      setErro(
        e instanceof ApiError
          ? e.message
          : "Contêiner não encontrado no sistema. Nenhuma operação registrada para esta unidade.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/operador/gate/dashboard" className="hover:text-white">
            Gate CPO
          </Link>
          <span>/</span>
          <span>Histórico de Contêiner</span>
        </div>
        <h1 className="text-2xl font-bold">Histórico de Contêiner</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Digite o número do contêiner para ver todas as passagens da unidade pelo terminal.
          Cada passagem é um processo único e não repetível.
        </p>
      </div>

      <div className="flex max-w-2xl gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Ex: MSCU 100113-7"
            value={busca}
            onChange={(e) => setBusca(formatContainerISO(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === "Enter") void buscarHistorico();
            }}
            className="pl-10 font-mono text-lg tabular-nums"
          />
        </div>
        <Button variant="default" onClick={() => void buscarHistorico()} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Buscando...
            </>
          ) : (
            "Buscar"
          )}
        </Button>
      </div>

      {erro ? (
        <div className="rounded bg-red-500/10 px-4 py-2 text-sm text-red-400">{erro}</div>
      ) : null}

      {resultado ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Contêiner</p>
                <p className="text-xl font-bold text-[var(--accent)]">
                  {formatContainerNumber(resultado.numeroISO)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Tipo</p>
                <p className="text-lg font-medium">
                  {resolveTipoContainerCodigo(resultado.tipo) || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Tamanho</p>
                <p className="text-lg font-medium">
                  {formatTamanhoContainerDisplay(resultado.tamanho) || "—"}
                </p>
              </div>
            </div>
            <div className="mt-3 border-t border-border/50 pt-3 text-xs text-muted-foreground">
              Primeira passagem: {formatDate(resultado.primeiraPassagem) || "—"} · Total de
              processos: {resultado.historico?.length || 0}
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <History className="h-5 w-5 text-[var(--accent)]" />
              Histórico de Passagens
            </h2>

            {(resultado.historico || []).map((passagem, index) => (
              <div
                key={`${passagem.processoId}-${index}`}
                className="overflow-hidden rounded-lg border border-border bg-card"
              >
                <div className="flex items-center justify-between border-b border-border bg-muted/20 p-4">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-muted-foreground">#{index + 1}</span>
                    <span className="font-bold text-[var(--accent)]">{passagem.processoId}</span>
                    <Badge variant="neutral" className="text-xs">
                      {passagem.tipoOperacao}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(passagem.dataProcesso)}
                  </span>
                </div>

                <div className="grid grid-cols-1 divide-y divide-border md:grid-cols-2 md:divide-x md:divide-y-0">
                  <div className="p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <ArrowDownCircle className="h-4 w-4 text-green-400" />
                      <span className="text-sm font-bold text-green-400">ENTRADA</span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <Row label="Data/Hora" value={formatDateTime(passagem.entrada?.dataHora)} />
                      <Row label="Situação" value={passagem.entrada?.situacao} badge />
                      <Row label="Motorista" value={passagem.entrada?.motorista} />
                      <Row label="Placa" value={passagem.entrada?.placa} mono />
                      <Row label="Empresa" value={passagem.entrada?.empresa} />
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <ArrowUpCircle className="h-4 w-4 text-purple-400" />
                      <span className="text-sm font-bold text-purple-400">SAÍDA</span>
                    </div>
                    {passagem.saida ? (
                      <div className="space-y-2 text-sm">
                        <Row label="Data/Hora" value={formatDateTime(passagem.saida.dataHora)} />
                        <Row label="Situação" value={passagem.saida.situacao} badge />
                        <Row label="Motorista" value={passagem.saida.motorista} />
                        <Row label="Placa" value={passagem.saida.placa} mono />
                      </div>
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-amber-400">
                        Aguardando saída
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t border-border bg-muted/10 p-3">
                  <Button
                    variant="link"
                    size="sm"
                    className="p-0 text-xs text-[var(--accent)]"
                    onClick={() =>
                      router.push(
                        `/operador/gate/operacao?processo=${encodeURIComponent(passagem.processoId)}`,
                      )
                    }
                  >
                    Ver detalhes completos →
                  </Button>
                </div>
              </div>
            ))}

            {resultado.historico?.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                Nenhuma operação registrada para este contêiner.
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Row({
  label,
  value,
  badge,
  mono,
}: {
  label: string;
  value?: string;
  badge?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}:</span>
      {badge ? (
        <Badge variant="neutral" className="text-xs">
          {value || "—"}
        </Badge>
      ) : (
        <span className={`font-medium ${mono ? "tabular-nums" : ""}`}>{value || "—"}</span>
      )}
    </div>
  );
}
