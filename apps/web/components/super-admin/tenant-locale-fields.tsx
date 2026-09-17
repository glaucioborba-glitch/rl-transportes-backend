"use client";

import { IDIOMAS_PADRAO, MOEDAS_CORRENTES } from "@/lib/financeiro/format";

const SELECT =
  "flex h-10 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white";

type Props = {
  moedaCorrente: string;
  idiomaPadrao: string;
  disabled?: boolean;
  onMoeda: (v: string) => void;
  onIdioma: (v: string) => void;
};

export function TenantLocaleFields({ moedaCorrente, idiomaPadrao, disabled, onMoeda, onIdioma }: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block text-xs uppercase tracking-wide text-zinc-500">
        Moeda corrente
        <select
          className={`${SELECT} mt-1`}
          value={moedaCorrente}
          disabled={disabled}
          onChange={(e) => onMoeda(e.target.value)}
        >
          {MOEDAS_CORRENTES.map((m) => (
            <option key={m.codigo} value={m.codigo}>
              {m.simbolo} — {m.nome} ({m.codigo})
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs uppercase tracking-wide text-zinc-500">
        Idioma padrão
        <select
          className={`${SELECT} mt-1`}
          value={idiomaPadrao}
          disabled={disabled}
          onChange={(e) => onIdioma(e.target.value)}
        >
          {IDIOMAS_PADRAO.map((i) => (
            <option key={i.codigo} value={i.codigo}>
              {i.nome}
            </option>
          ))}
        </select>
      </label>
      <p className="sm:col-span-2 text-xs text-zinc-500">
        Vale para todo o terminal. Nenhum usuário da intranet altera estes campos.
      </p>
    </div>
  );
}
