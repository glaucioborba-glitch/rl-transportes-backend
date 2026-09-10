import type { EmpresaRegimeTributario } from './empresa-operadora.types';

export type EncargoLinha = {
  codigo: string;
  label: string;
  aliquotaPct: number;
  valor: number;
  entraNaSoma: boolean;
  nota?: string;
};

export type EncargosInput = {
  regime: EmpresaRegimeTributario;
  receita: number;
  aliquotaIss: number;
  aliquotaPis: number;
  aliquotaCofins: number;
  aliquotaCsll: number;
  aliquotaIrpj: number;
  simplesAnexo?: string;
};

export type EncargosResultado = {
  regime: EmpresaRegimeTributario;
  receita: number;
  linhas: EncargoLinha[];
  total: number;
  cargaEfetivaPct: number;
  avisos: string[];
};

function money(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100) / 100;
}

function linha(
  codigo: string,
  label: string,
  aliquotaPct: number,
  receita: number,
  entraNaSoma: boolean,
  nota?: string,
): EncargoLinha {
  const aliq = Number.isFinite(aliquotaPct) ? Math.max(0, aliquotaPct) : 0;
  return {
    codigo,
    label,
    aliquotaPct: aliq,
    valor: entraNaSoma ? money((receita * aliq) / 100) : 0,
    entraNaSoma,
    nota,
  };
}

export type EncargosGeradoPor = 'CRON' | 'USUARIO' | 'PREVIA';

/** Competência YYYY-MM do mês civil corrente. */
export function competenciaAtual(ref: Date = new Date()): string {
  return `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}`;
}

/** Competência YYYY-MM do mês civil anterior (America/Sao_Paulo via Date local do servidor). */
export function competenciaMesAnterior(ref: Date = new Date()): string {
  const d = new Date(ref.getFullYear(), ref.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Cron fecha o mês; só substitui prévia — não apaga fechamento automático nem gravação do financeiro. */
export function cronPodeFechar(existente?: { geradoPor?: EncargosGeradoPor } | null): boolean {
  return !existente || existente.geradoPor === 'PREVIA';
}

/** Gerar agora atualiza só prévia (ou cria). Não sobrescreve CRON/USUARIO. */
export function previaPodeGravar(existente?: { geradoPor?: EncargosGeradoPor } | null): boolean {
  return !existente || existente.geradoPor === 'PREVIA';
}

export function simularEncargos(input: EncargosInput): EncargosResultado {
  const receita = money(input.receita);
  const avisos: string[] = [
    'Provisão simulada. Não é guia, DAS, DARF nem título a pagar até o financeiro confirmar.',
  ];

  let linhas: EncargoLinha[];
  if (input.regime === 'SIMPLES_NACIONAL') {
    const anexo = input.simplesAnexo?.trim();
    linhas = [
      linha(
        'DAS',
        anexo ? `DAS / Simples (${anexo})` : 'DAS / alíquota efetiva informada',
        input.aliquotaIss,
        receita,
        true,
        'No Simples a alíquota da ficha (ISS) é usada como efetiva do DAS. PIS, COFINS, CSLL e IRPJ não somam de novo.',
      ),
      linha('PIS', 'PIS (já no DAS)', input.aliquotaPis, receita, false, 'Informativo — não soma.'),
      linha('COFINS', 'COFINS (já no DAS)', input.aliquotaCofins, receita, false, 'Informativo — não soma.'),
      linha('CSLL', 'CSLL (já no DAS)', input.aliquotaCsll, receita, false, 'Informativo — não soma.'),
      linha('IRPJ', 'IRPJ (já no DAS)', input.aliquotaIrpj, receita, false, 'Informativo — não soma.'),
    ];
    avisos.push(
      'Regime Simples: uma linha só entra no total (DAS). Ajuste a alíquota ISS da ficha se a efetiva do anexo for outra.',
    );
  } else {
    const regimeLabel = input.regime === 'LUCRO_PRESUMIDO' ? 'presumido' : 'real';
    linhas = [
      linha('ISS', 'ISS', input.aliquotaIss, receita, true),
      linha('PIS', 'PIS', input.aliquotaPis, receita, true),
      linha('COFINS', 'COFINS', input.aliquotaCofins, receita, true),
      linha('CSLL', 'CSLL (provisão sobre receita)', input.aliquotaCsll, receita, true),
      linha('IRPJ', 'IRPJ (provisão sobre receita)', input.aliquotaIrpj, receita, true),
    ];
    avisos.push(
      `Lucro ${regimeLabel}: ISS, PIS e COFINS sobre a receita; CSLL e IRPJ usam o % da ficha como provisão (não é apuração oficial).`,
    );
  }

  const total = money(linhas.filter((l) => l.entraNaSoma).reduce((s, l) => s + l.valor, 0));
  const cargaEfetivaPct = receita > 0 ? money((total / receita) * 100) : 0;

  return {
    regime: input.regime,
    receita,
    linhas,
    total,
    cargaEfetivaPct,
    avisos,
  };
}
