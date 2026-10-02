import type { FaturaComposicaoLinha } from "@/lib/api/fatura-pacote-client";
import { formatBRL } from "@/lib/financeiro/format";

export function FaturaIdComposicao({ linhas }: { linhas: FaturaComposicaoLinha[] }) {
  if (linhas.length === 0) {
    return <p className="text-sm text-zinc-500">Sem linhas de composição neste ID.</p>;
  }

  return (
    <ul className="divide-y divide-zinc-800">
      {linhas.map((linha) => (
        <li key={linha.id} className="flex items-start justify-between gap-3 py-2 text-sm">
          <span className="text-zinc-200">
            {linha.descricao}
            {linha.detalheCobranca ? (
              <span className="block text-[11px] text-zinc-500">{linha.detalheCobranca}</span>
            ) : linha.quantidade > 1 ? (
              <span className="block text-[11px] text-zinc-500">
                {linha.quantidade} × {formatBRL(linha.valorUnitario)}
              </span>
            ) : null}
          </span>
          <span className="shrink-0 tabular-nums text-zinc-100">{formatBRL(linha.valorTotal)}</span>
        </li>
      ))}
    </ul>
  );
}
