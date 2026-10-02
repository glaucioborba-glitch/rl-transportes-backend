import { parsePatioZonaPosicao } from './patio-fila.util';

export type PatioSaldoUnidade = {
  id: string;
  unidadeIso: string;
  status: string;
  refrigerado: boolean;
  cliente: string;
  clienteId?: string;
  baia: string | null;
  entradaEm: string;
  processoNumero: number | null;
  processo: string;
  booking: string;
  navio: string;
  situacao: string;
  tamanho: string;
  tamanhoLabel: string;
};

export function matchContainerSolicitacao<
  T extends { unidade: string; booking: string; processo: string; navio: string },
>(iso: string, containers: T[]): T | null {
  const n = iso.replace(/\s/g, '').toUpperCase();
  return containers.find((c) => c.unidade.replace(/\s/g, '').toUpperCase() === n) ?? null;
}

export type PatioSaldoFiltro = {
  q?: string;
  tipo?: 'TODOS' | 'REEFER' | 'DRY';
  diasMin?: number;
  status?: string;
  situacao?: string;
  tamanho?: string;
  baia?: string;
  cliente?: string;
};

export function diasNoPatio(entradaEm: string, now = Date.now()): number {
  const t = new Date(entradaEm).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((now - t) / 86_400_000));
}

export function filtrarSaldoUnidades(
  unidades: PatioSaldoUnidade[],
  f: PatioSaldoFiltro,
  now = Date.now(),
): PatioSaldoUnidade[] {
  const q = (f.q ?? '').trim().toLowerCase();
  const tipo = (f.tipo ?? 'TODOS').toUpperCase();
  const diasMin = f.diasMin && f.diasMin > 0 ? f.diasMin : 0;
  const situacao = (f.situacao ?? '').trim().toUpperCase();
  const tamanho = (f.tamanho ?? '').trim();
  const baia = (f.baia ?? 'TODAS').trim();
  const cliente = (f.cliente ?? '').trim().toLowerCase();

  return unidades.filter((u) => {
    const zp = parsePatioZonaPosicao(u.baia);
    if (tipo === 'REEFER' && !u.refrigerado) return false;
    if (tipo === 'DRY' && u.refrigerado) return false;
    if (diasMin && diasNoPatio(u.entradaEm, now) < diasMin) return false;
    if (situacao && situacao !== 'TODOS' && u.situacao.toUpperCase() !== situacao) return false;
    if (tamanho && tamanho !== 'TODOS' && u.tamanho !== tamanho) return false;
    if (baia === 'SEM' && u.baia) return false;
    if (baia === 'COM' && !u.baia) return false;
    if (baia && baia !== 'TODAS' && baia !== 'SEM' && baia !== 'COM') {
      const wanted = baia.toUpperCase();
      const sameCode = (u.baia ?? '').toUpperCase() === wanted;
      const sameZona = zp?.zona === wanted;
      const sameSlot = zp ? `${zp.zona}-${zp.posicao}` === wanted : false;
      if (!sameCode && !sameZona && !sameSlot) return false;
    }
    if (cliente) {
      const hit =
        (u.cliente ?? '').toLowerCase().includes(cliente) || (u.clienteId ?? '') === f.cliente;
      if (!hit) return false;
    }
    if (q) {
      const blob = [
        u.unidadeIso,
        u.cliente,
        u.processo,
        u.booking,
        u.navio,
        u.baia ?? '',
        zp?.zona ?? '',
        zp?.posicao != null ? String(zp.posicao) : '',
        u.situacao,
        u.tamanho,
        u.tamanhoLabel,
        u.processoNumero != null ? `ID ${u.processoNumero}` : '',
      ]
        .join(' ')
        .toLowerCase();
      if (!blob.includes(q)) return false;
    }
    return true;
  });
}

export function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function formatCnpj(cnpj: string): string {
  const clean = cnpj.replace(/\D/g, '');
  if (clean.length !== 14) return cnpj || '—';
  return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

export function rotuloFiltrosSaldo(f: PatioSaldoFiltro): string {
  const parts: string[] = [];
  if (f.q?.trim()) parts.push(`busca="${f.q.trim()}"`);
  if (f.tipo && f.tipo !== 'TODOS') parts.push(f.tipo === 'REEFER' ? 'Reefer' : 'Dry');
  if (f.diasMin && f.diasMin > 0) parts.push(`≥${f.diasMin} dias`);
  if (f.situacao?.trim() && f.situacao.toUpperCase() !== 'TODOS') parts.push(f.situacao);
  if (f.tamanho?.trim() && f.tamanho !== 'TODOS') parts.push(`${f.tamanho}'`);
  if (f.baia && f.baia !== 'TODAS') {
    if (f.baia === 'SEM') parts.push('sem posição');
    else if (f.baia === 'COM') parts.push('com posição');
    else parts.push(`zona ${f.baia}`);
  }
  if (f.cliente?.trim()) parts.push(`cliente="${f.cliente.trim()}"`);
  return parts.length ? parts.join(' · ') : 'Todos';
}

export function buildSaldoXml(opts: {
  geradoEm: string;
  empresa: { nome: string; razaoSocial: string; cnpj: string };
  lotacaoTotal: number;
  capacidadeTotal: number;
  reefers: number;
  semBaia: number;
  filtros: PatioSaldoFiltro;
  unidades: PatioSaldoUnidade[];
}): string {
  const linhas = opts.unidades
    .map((u) => {
      const dias = diasNoPatio(u.entradaEm);
      const zp = parsePatioZonaPosicao(u.baia);
      return [
        '  <unidade>',
        `    <iso>${xmlEscape(u.unidadeIso)}</iso>`,
        `    <idProcesso>${u.processoNumero != null ? xmlEscape(`ID ${u.processoNumero}`) : ''}</idProcesso>`,
        `    <tipo>${u.refrigerado ? 'Reefer' : 'Dry'}</tipo>`,
        `    <situacao>${xmlEscape(u.situacao)}</situacao>`,
        `    <tamanho>${xmlEscape(u.tamanhoLabel || u.tamanho)}</tamanho>`,
        `    <baia>${xmlEscape(u.baia ?? '')}</baia>`,
        `    <zona>${xmlEscape(zp?.zona ?? '')}</zona>`,
        `    <posicao>${zp?.posicao ?? ''}</posicao>`,
        `    <entrada>${xmlEscape(u.entradaEm)}</entrada>`,
        `    <diasNoPatio>${dias}</diasNoPatio>`,
        `    <cliente>${xmlEscape(u.cliente)}</cliente>`,
        `    <processo>${xmlEscape(u.processo)}</processo>`,
        `    <booking>${xmlEscape(u.booking)}</booking>`,
        `    <navio>${xmlEscape(u.navio)}</navio>`,
        '  </unidade>',
      ].join('\n');
    })
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<saldoUnidades geradoEm="${xmlEscape(opts.geradoEm)}" filtros="${xmlEscape(rotuloFiltrosSaldo(opts.filtros))}">`,
    '  <empresa>',
    `    <nome>${xmlEscape(opts.empresa.nome)}</nome>`,
    `    <razaoSocial>${xmlEscape(opts.empresa.razaoSocial)}</razaoSocial>`,
    `    <cnpj>${xmlEscape(formatCnpj(opts.empresa.cnpj))}</cnpj>`,
    '  </empresa>',
    '  <resumo>',
    `    <total>${opts.unidades.length}</total>`,
    `    <lotacao>${opts.lotacaoTotal}</lotacao>`,
    `    <capacidade>${opts.capacidadeTotal}</capacidade>`,
    `    <reefers>${opts.reefers}</reefers>`,
    `    <semBaia>${opts.semBaia}</semBaia>`,
    '  </resumo>',
    linhas,
    '</saldoUnidades>',
    '',
  ].join('\n');
}
