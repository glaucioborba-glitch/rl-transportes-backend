import { CategoriaItemTabelaPreco } from '@prisma/client';
import { formatTamanhoContainerMatrix } from '../cadastros/tipo-container-tamanhos.util';
import {
  calcularEnergiaEscalonada,
  resolveFaixasEnergiaFromCadastroItem,
  valorMedioEnergiaEscalonada,
} from '../billing-engine/faixa-diaria-calculator';
import { computeDiasEnergiaFromTomadaEvents } from '../billing-engine/billing-rule-engine.util';
import {
  pickOperacaoItem,
  tiposContainerParaMatch,
} from '../cx-portais/portal-simulacao-valores.util';

export const CODIGO_HANDLING_ABERTURA = 'HANDLING';
export const CODIGO_TOMADA_ABERTURA = 'TOMADA';

const CODIGOS_TOMADA_OPERACAO = ['TOMADA', 'TOMADA_REEFER', 'ENERGIA_REEFER'] as const;

export type ItemTabelaAberturaLike = {
  id?: string;
  categoriaItem?: string | null;
  tipoOperacaoCodigo: string;
  tipoContainerCodigo: string | null;
  containerTamanho: string | null;
  statusContainer?: string | null;
  valorHandling?: unknown;
  tarifaEnergiaReeferDiaria?: unknown;
  faixasEnergiaReefer?: unknown;
  valor?: unknown;
  unidade?: string | null;
};

export type PayloadServicoAutomaticoTabela = {
  automatico: true;
  origem: 'TABELA_PRECO';
  efeito: 'NENHUM';
  tabelaId?: string;
  itemId?: string;
  cobranca?: 'HANDLING' | 'ENERGIA_REEFER';
  diasLigados?: number;
  conectada?: boolean;
};

export type LinhaAberturaTabela = {
  codigo: string;
  nome: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  payload: PayloadServicoAutomaticoTabela;
};

export function isLancamentoAutomaticoTabela(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false;
  return (payload as { automatico?: unknown }).automatico === true;
}

export function isHandlingAutomaticoCodigo(codigo: string | null | undefined): boolean {
  return (codigo ?? '').trim().toUpperCase() === CODIGO_HANDLING_ABERTURA;
}

export function isTomadaAutomaticoCodigo(codigo: string | null | undefined): boolean {
  return (codigo ?? '').trim().toUpperCase() === CODIGO_TOMADA_ABERTURA;
}

export type TipoAutomaticoExcluivel = 'HANDLING' | 'TOMADA';

export function tipoAutomaticoExcluivel(codigo: string | null | undefined): TipoAutomaticoExcluivel | null {
  if (isHandlingAutomaticoCodigo(codigo)) return 'HANDLING';
  if (isTomadaAutomaticoCodigo(codigo)) return 'TOMADA';
  return null;
}

/** Soft-exclude: o lançamento permanece (evita relançar) mas some da pré-fatura. */
export function isLancamentoAutomaticoExcluido(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false;
  return (payload as { excluido?: unknown }).excluido === true;
}

export type PayloadExclusaoAutomatico = {
  motivo: string;
  gerenteId: string;
  gerenteEmail?: string;
  actorUserId: string;
  em: string;
  anexoNome?: string;
  anexoMime?: string;
  anexoStorageKey?: string;
  anexoTamanho?: number;
};

export function payloadExclusaoAutomatico(payload: unknown): PayloadExclusaoAutomatico | null {
  if (!payload || typeof payload !== 'object') return null;
  const raw = (payload as { exclusao?: unknown }).exclusao;
  if (!raw || typeof raw !== 'object') return null;
  const exclusao = raw as Record<string, unknown>;
  const motivo = typeof exclusao.motivo === 'string' ? exclusao.motivo : '';
  const gerenteId = typeof exclusao.gerenteId === 'string' ? exclusao.gerenteId : '';
  if (!motivo || !gerenteId) return null;
  return {
    motivo,
    gerenteId,
    gerenteEmail: typeof exclusao.gerenteEmail === 'string' ? exclusao.gerenteEmail : undefined,
    actorUserId: typeof exclusao.actorUserId === 'string' ? exclusao.actorUserId : '',
    em: typeof exclusao.em === 'string' ? exclusao.em : '',
    anexoNome: typeof exclusao.anexoNome === 'string' ? exclusao.anexoNome : undefined,
    anexoMime: typeof exclusao.anexoMime === 'string' ? exclusao.anexoMime : undefined,
    anexoStorageKey: typeof exclusao.anexoStorageKey === 'string' ? exclusao.anexoStorageKey : undefined,
    anexoTamanho: typeof exclusao.anexoTamanho === 'number' ? exclusao.anexoTamanho : undefined,
  };
}

function toMoney(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

function isArmazenagem(item: ItemTabelaAberturaLike): boolean {
  return (
    item.categoriaItem === CategoriaItemTabelaPreco.ARMAZENAGEM ||
    item.tipoOperacaoCodigo?.toUpperCase() === 'ARMAZENAGEM'
  );
}

function scoreItemMatriz(
  item: ItemTabelaAberturaLike,
  tipoKeys: string[],
  tamanho: string,
  status: 'CHEIO' | 'VAZIO',
): number {
  if (!isArmazenagem(item)) return -1;

  const st = (item.statusContainer ?? 'AMBOS').toUpperCase();
  if (st !== 'AMBOS' && st !== status) return -1;

  const tc = (item.tipoContainerCodigo ?? '').trim().toUpperCase();
  let score = 0;
  if (tc && tc !== '*') {
    if (!tipoKeys.includes(tc)) return -1;
    score += 4;
  } else {
    score += 1;
  }

  const rawTam = (item.containerTamanho ?? '').trim();
  const itemTam = !rawTam || rawTam === '*' ? '' : formatTamanhoContainerMatrix(rawTam);
  if (itemTam) {
    if (tamanho && itemTam !== tamanho) return -1;
    if (tamanho && itemTam === tamanho) score += 2;
  } else {
    score += 1;
  }

  score += st === status ? 2 : 1;
  return score;
}

export function pickItemMatrizArmazenagem(
  itens: ItemTabelaAberturaLike[],
  tipo: string | null | undefined,
  tamanhoRaw: string | null | undefined,
  status: 'CHEIO' | 'VAZIO',
  refrigerado = false,
): ItemTabelaAberturaLike | null {
  const tipoKeys = tiposContainerParaMatch(tipo, refrigerado);
  const tamanho = formatTamanhoContainerMatrix(tamanhoRaw);
  const ranked = itens
    .map((item) => ({ item, score: scoreItemMatriz(item, tipoKeys, tamanho, status) }))
    .filter((x) => x.score >= 0)
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.item ?? null;
}

/** Célula com diária de energia (REEFER ou dry ligado na tomada). */
export function pickItemMatrizEnergia(
  itens: ItemTabelaAberturaLike[],
  tipo: string | null | undefined,
  tamanhoRaw: string | null | undefined,
  status: 'CHEIO' | 'VAZIO',
): ItemTabelaAberturaLike | null {
  const comEnergia = itens.filter((i) => valorTomadaDaMatriz(i) != null);
  return (
    pickItemMatrizArmazenagem(comEnergia, tipo, tamanhoRaw, status, true) ??
    pickItemMatrizArmazenagem(comEnergia, tipo, tamanhoRaw, status, false) ??
    comEnergia[0] ??
    null
  );
}

export function valorTomadaDaMatriz(item: ItemTabelaAberturaLike | null): number | null {
  if (!item) return null;
  const faixas = resolveFaixasEnergiaFromCadastroItem({
    faixasEnergiaReefer: item.faixasEnergiaReefer,
    tarifaEnergiaReeferDiaria:
      item.tarifaEnergiaReeferDiaria != null ? Number(item.tarifaEnergiaReeferDiaria) : null,
  });
  const daFaixa = faixas[0]?.valorDiaria;
  if (daFaixa != null && Number.isFinite(daFaixa)) return Math.round(daFaixa * 100) / 100;
  return toMoney(item.tarifaEnergiaReeferDiaria);
}

function pickOperacaoTomada(
  itens: ItemTabelaAberturaLike[],
  tipo: string | null | undefined,
  tamanho: string | null | undefined,
  refrigerado: boolean,
): ItemTabelaAberturaLike | null {
  const ops = itens
    .filter((i) => i.categoriaItem === CategoriaItemTabelaPreco.OPERACAO || !isArmazenagem(i))
    .map((i) => ({
      ...i,
      valor: Number(i.valor ?? 0),
      unidade: i.unidade ?? 'POR_OPERACAO',
    }));
  for (const codigo of CODIGOS_TOMADA_OPERACAO) {
    const hit = pickOperacaoItem(ops, codigo, tipo, tamanho, refrigerado);
    if (hit && Number.isFinite(Number(hit.valor))) return hit;
  }
  return null;
}

export function buildLinhasAberturaTabela(input: {
  itens: ItemTabelaAberturaLike[];
  tabelaId?: string;
  tipo?: string | null;
  tamanho?: string | null;
  status?: string | null;
  refrigerado?: boolean;
}): LinhaAberturaTabela[] {
  const status = input.status?.toUpperCase() === 'VAZIO' ? 'VAZIO' : 'CHEIO';
  const matriz = pickItemMatrizArmazenagem(
    input.itens,
    input.tipo,
    input.tamanho,
    status,
    Boolean(input.refrigerado),
  );

  const linhas: LinhaAberturaTabela[] = [];

  if (matriz) {
    const handling = toMoney(matriz.valorHandling);
    if (handling != null) {
      linhas.push({
        codigo: CODIGO_HANDLING_ABERTURA,
        nome: 'Handling',
        quantidade: 1,
        valorUnitario: handling,
        valorTotal: handling,
        payload: {
          automatico: true,
          origem: 'TABELA_PRECO',
          efeito: 'NENHUM',
          tabelaId: input.tabelaId,
          itemId: matriz.id,
          cobranca: 'HANDLING',
        },
      });
    }
  }

  return linhas;
}

/** Dia 1 = primeiro dia ligado (mesmo que ligue e desligue no mesmo dia). */
export function diasTomadaFaturaveis(
  eventos: Array<{ tipo: 'CONECTADO' | 'DESCONECTADO'; at: Date }>,
  asOf: Date,
  conectada: boolean,
): number {
  const dias = computeDiasEnergiaFromTomadaEvents(eventos, asOf);
  if (dias >= 1) return dias;
  const teveConexao = conectada || eventos.some((e) => e.tipo === 'CONECTADO');
  return teveConexao ? 1 : 0;
}

export function buildLinhaTomadaDiaria(input: {
  itens: ItemTabelaAberturaLike[];
  tabelaId?: string;
  tipo?: string | null;
  tamanho?: string | null;
  status?: string | null;
  dias: number;
  conectada?: boolean;
}): LinhaAberturaTabela | null {
  if (input.dias < 1) return null;
  const status = input.status?.toUpperCase() === 'VAZIO' ? 'VAZIO' : 'CHEIO';
  const matriz = pickItemMatrizEnergia(input.itens, input.tipo, input.tamanho, status);
  const faixas = matriz
    ? resolveFaixasEnergiaFromCadastroItem({
        faixasEnergiaReefer: matriz.faixasEnergiaReefer,
        tarifaEnergiaReeferDiaria:
          matriz.tarifaEnergiaReeferDiaria != null ? Number(matriz.tarifaEnergiaReeferDiaria) : null,
      })
    : [];

  const opTomada = pickOperacaoTomada(input.itens, input.tipo, input.tamanho, true);
  const valorOp = opTomada ? toMoney(opTomada.valor) : null;

  let valorUnitario: number;
  let valorTotal: number;
  if (faixas.length) {
    const { valorMedio, total } = valorMedioEnergiaEscalonada(input.dias, faixas);
    valorUnitario = valorMedio;
    valorTotal = total;
    if (valorTotal <= 0 && calcularEnergiaEscalonada(input.dias, faixas) <= 0) {
      const flat = valorTomadaDaMatriz(matriz);
      if (flat == null) return null;
      valorUnitario = flat;
      valorTotal = Math.round(flat * input.dias * 100) / 100;
    }
  } else if (valorOp != null) {
    valorUnitario = valorOp;
    valorTotal = Math.round(valorOp * input.dias * 100) / 100;
  } else {
    const flat = valorTomadaDaMatriz(matriz);
    if (flat == null) return null;
    valorUnitario = flat;
    valorTotal = Math.round(flat * input.dias * 100) / 100;
  }

  return {
    codigo: CODIGO_TOMADA_ABERTURA,
    nome: 'Tomada',
    quantidade: input.dias,
    valorUnitario,
    valorTotal,
    payload: {
      automatico: true,
      origem: 'TABELA_PRECO',
      efeito: 'NENHUM',
      tabelaId: input.tabelaId,
      itemId: matriz?.id ?? opTomada?.id,
      cobranca: 'ENERGIA_REEFER',
      diasLigados: input.dias,
      conectada: Boolean(input.conectada),
    },
  };
}
