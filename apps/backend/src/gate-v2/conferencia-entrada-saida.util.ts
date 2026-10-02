export type ConferenciaStatus = 'CONFERE' | 'DIVERGENTE' | 'SEM_CAPTURA';
export type ConferenciaCampoId =
  | 'container'
  | 'placa'
  | 'placaCavalo'
  | 'placaCarreta'
  | 'placaCarreta02'
  | 'lacre'
  | 'motorista'
  | 'cpf';
export type OrigemCaptura = 'OCR' | 'PORTARIA' | 'AUSENTE';

export type ConferenciaCampo = {
  campo: ConferenciaCampoId;
  label: string;
  solicitado: string;
  capturado: string;
  origemCaptura: OrigemCaptura;
  status: ConferenciaStatus;
};

export type ConferenciaResumo = {
  conferem: number;
  divergentes: number;
  semCaptura: number;
};

export type ControleColuna = 'NA_PORTARIA' | 'A_CONFERIR' | 'RIC_PENDENTE' | 'LIBERADO' | 'PRONTO_SAIDA';

const LABELS: Record<ConferenciaCampoId, string> = {
  container: 'Contêiner',
  placa: 'Placa cavalo',
  placaCavalo: 'Placa cavalo',
  placaCarreta: 'Placa carreta',
  placaCarreta02: 'Placa carreta 02',
  lacre: 'Lacre',
  motorista: 'Motorista',
  cpf: 'CPF do motorista',
};

const OCR_CAMPOS: ConferenciaCampoId[] = [
  'container',
  'placaCavalo',
  'placaCarreta',
  'placaCarreta02',
  'lacre',
];

export function isCampoOcr(campo: ConferenciaCampoId): boolean {
  return OCR_CAMPOS.includes(campo);
}

export function normalizePlaca(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();
}

export function normalizeContainer(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/[\s-]/g, '')
    .toUpperCase();
}

export function normalizeLacre(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/[\s-]/g, '')
    .toUpperCase();
}

export function normalizeNome(value: string | null | undefined): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

export function normalizeCpf(value: string | null | undefined): string {
  return String(value ?? '').replace(/\D/g, '');
}

export function isRodotrem(tipoCaminhao: string | null | undefined): boolean {
  return String(tipoCaminhao ?? '').toUpperCase() === 'RODOTREM';
}

/** Tipos de foto que contam como evidência do lacre (portaria `LACRE` ou OCR `LACRE_OCR`). */
export const TIPOS_FOTO_LACRE = ['LACRE_OCR', 'LACRE'] as const;

const MSG_LACRE_FOTO_OBRIGATORIA =
  'Foto do lacre é obrigatória para contêiner cheio. IsoTank é a única exceção (lacre inacessível).';

export function mensagemLacreFotoObrigatoria(): string {
  return MSG_LACRE_FOTO_OBRIGATORIA;
}

/** IsoTank (e alias legado TANK): lacre físico não é acessível. */
export function isTipoIsoTank(tipoContainer: string | null | undefined): boolean {
  const tipo = String(tipoContainer ?? '')
    .replace(/[\s-]/g, '')
    .toUpperCase();
  return tipo === 'ISOTANK' || tipo === 'TANK';
}

/**
 * Garantia legal: contêiner CHEIO exige foto do lacre.
 * Única exceção: IsoTank.
 */
export function lacreFotoObrigatoria(
  situacao: string | null | undefined,
  tipoContainer: string | null | undefined,
): boolean {
  return String(situacao ?? '').toUpperCase() === 'CHEIO' && !isTipoIsoTank(tipoContainer);
}

export function lacreFotoPresente(
  fotos: Array<{ tipo?: string; imagem?: string }> | null | undefined,
  fotosLacreExtras: string[] | null | undefined = [],
): boolean {
  const hasTipo = (fotos ?? []).some((f) => {
    const tipo = String(f.tipo ?? '').toUpperCase();
    if (!(TIPOS_FOTO_LACRE as readonly string[]).includes(tipo)) return false;
    return String(f.imagem ?? '').trim().length > 0;
  });
  if (hasTipo) return true;
  return (fotosLacreExtras ?? []).some((u) => String(u ?? '').trim().length > 0);
}

/** Cabo de conexão com a tomada — bem de alto valor, sujeito a furto. */
export const TIPOS_FOTO_CABO_TOMADA = ['CABO_TOMADA', 'CABO_REEFER', 'TOMADA_REEFER'] as const;

const MSG_CABO_TOMADA_FOTO_OBRIGATORIA =
  'Foto do cabo da tomada é obrigatória para contêiner reefer (ligado ou não).';

export function mensagemCaboTomadaFotoObrigatoria(): string {
  return MSG_CABO_TOMADA_FOTO_OBRIGATORIA;
}

/**
 * Reefer de verdade (tem cabo/tomada). REEFERDRY não exige.
 * `refrigerado=true` na solicitação também conta, mesmo com tipo legado.
 */
export function isTipoReefer(
  tipoContainer: string | null | undefined,
  refrigerado?: boolean | null,
): boolean {
  if (refrigerado === true) return true;
  const tipo = String(tipoContainer ?? '')
    .replace(/[\s-]/g, '')
    .toUpperCase();
  if (!tipo || tipo === 'REEFERDRY') return false;
  return tipo === 'REEFER' || tipo === 'RF';
}

export function caboTomadaFotoObrigatoria(
  tipoContainer: string | null | undefined,
  refrigerado?: boolean | null,
): boolean {
  return isTipoReefer(tipoContainer, refrigerado);
}

export function caboTomadaFotoPresente(
  fotos: Array<{ tipo?: string; imagem?: string }> | null | undefined,
): boolean {
  return (fotos ?? []).some((f) => {
    const tipo = String(f.tipo ?? '').toUpperCase();
    if (!(TIPOS_FOTO_CABO_TOMADA as readonly string[]).includes(tipo)) return false;
    return String(f.imagem ?? '').trim().length > 0;
  });
}

export const MOTIVOS_DEVOLVER_PORTARIA = [
  'FOTOS_REFAZER',
  'FALTA_CABO_TOMADA',
  'FALTA_LACRE',
  'FALTA_FOTOS_OBRIGATORIAS',
  'FOTOS_ILLEGIVEIS',
] as const;

export type MotivoDevolverPortaria = (typeof MOTIVOS_DEVOLVER_PORTARIA)[number];

export const ROTULO_FOTO_VISTORIA: Record<string, string> = {
  CONTAINER_OCR: 'Contêiner',
  PLACA_OCR: 'Placa cavalo',
  PLACA_CAVALO_OCR: 'Placa cavalo',
  PLACA_CARRETA_OCR: 'Placa carreta',
  PLACA_CARRETA01_OCR: 'Placa carreta',
  PLACA_CARRETA_01_OCR: 'Placa carreta',
  PLACA_CARRETA_02_OCR: 'Placa carreta 02',
  PLACA_CARRETA02_OCR: 'Placa carreta 02',
  LACRE_OCR: 'Lacre',
  LACRE: 'Lacre',
  CABO_TOMADA: 'Cabo da tomada',
  CABO_REEFER: 'Cabo da tomada',
  TOMADA_REEFER: 'Cabo da tomada',
  LADO_FRONTAL: 'Frontal',
  LADO_TRASEIRO: 'Traseiro',
  LADO_DIREITO: 'Lado direito',
  LADO_ESQUERDO: 'Lado esquerdo',
};

export const ALIASES_FOTO_REFAZER: Record<string, readonly string[]> = {
  CONTAINER_OCR: ['CONTAINER_OCR'],
  PLACA_OCR: ['PLACA_OCR', 'PLACA_CAVALO_OCR'],
  PLACA_CAVALO_OCR: ['PLACA_OCR', 'PLACA_CAVALO_OCR'],
  PLACA_CARRETA_OCR: ['PLACA_CARRETA_OCR', 'PLACA_CARRETA01_OCR', 'PLACA_CARRETA_01_OCR'],
  PLACA_CARRETA_02_OCR: ['PLACA_CARRETA_02_OCR', 'PLACA_CARRETA02_OCR'],
  LACRE: ['LACRE', 'LACRE_OCR'],
  CABO_TOMADA: ['CABO_TOMADA', 'CABO_REEFER', 'TOMADA_REEFER'],
  LADO_FRONTAL: ['LADO_FRONTAL'],
  LADO_TRASEIRO: ['LADO_TRASEIRO'],
  LADO_DIREITO: ['LADO_DIREITO'],
  LADO_ESQUERDO: ['LADO_ESQUERDO'],
};

export function tiposEquivalentesFoto(tipo: string): string[] {
  const key = String(tipo ?? '').toUpperCase();
  return [...(ALIASES_FOTO_REFAZER[key] ?? [key])];
}

/** Fotos mínimas da vistoria na portaria (cavalo + carreta + 4 faces). */
export const TIPOS_FOTO_VISTORIA_BASE = [
  'CONTAINER_OCR',
  'PLACA_OCR',
  'PLACA_CARRETA_OCR',
  'LADO_FRONTAL',
  'LADO_TRASEIRO',
  'LADO_DIREITO',
  'LADO_ESQUERDO',
] as const;

export function tiposFotoVistoriaObrigatorias(tipoCaminhao?: string | null): string[] {
  const tipos: string[] = [...TIPOS_FOTO_VISTORIA_BASE];
  if (isRodotrem(tipoCaminhao)) {
    const idx = tipos.indexOf('PLACA_CARRETA_OCR');
    tipos.splice(idx + 1, 0, 'PLACA_CARRETA_02_OCR');
  }
  return tipos;
}

export function fotoVistoriaPresente(
  fotos: Array<{ tipo?: string; imagem?: string }> | null | undefined,
  tipoCanonico: string,
): boolean {
  const aliases = new Set(tiposEquivalentesFoto(tipoCanonico).map((t) => t.toUpperCase()));
  return (fotos ?? []).some((f) => {
    if (!aliases.has(String(f.tipo ?? '').toUpperCase())) return false;
    return String(f.imagem ?? '').trim().length > 0;
  });
}

export function fotosVistoriaObrigatoriasAusentes(
  fotos: Array<{ tipo?: string; imagem?: string }> | null | undefined,
  tipoCaminhao?: string | null,
): string[] {
  return tiposFotoVistoriaObrigatorias(tipoCaminhao).filter((t) => !fotoVistoriaPresente(fotos, t));
}

export function rotuloFotoVistoria(tipo: string): string {
  const key = String(tipo ?? '').toUpperCase();
  return ROTULO_FOTO_VISTORIA[key] ?? key.replace(/_/g, ' ').toLowerCase();
}

export function removerFotosRefazer<T extends { tipo?: string }>(
  fotos: T[] | null | undefined,
  tiposRefazer: string[] | null | undefined,
): T[] {
  const ban = new Set(
    (tiposRefazer ?? []).flatMap((tipo) => tiposEquivalentesFoto(tipo).map((t) => t.toUpperCase())),
  );
  return (fotos ?? []).filter((f) => !ban.has(String(f.tipo ?? '').toUpperCase()));
}

const MSG_DEVOLVER_PORTARIA: Record<MotivoDevolverPortaria, string> = {
  FOTOS_REFAZER:
    'Gate devolveu para refazer fotos da vistoria. Check-in e as demais fotos permanecem.',
  FALTA_CABO_TOMADA:
    'Gate devolveu: falta a foto do cabo da tomada (reefer, ligado ou não). Check-in e as demais fotos permanecem.',
  FALTA_LACRE:
    'Gate devolveu: falta a foto do lacre (contêiner cheio). Check-in e as demais fotos permanecem.',
  FALTA_FOTOS_OBRIGATORIAS:
    'Gate devolveu: faltam fotos obrigatórias da vistoria. Check-in e as fotos já tiradas permanecem.',
  FOTOS_ILLEGIVEIS:
    'Gate devolveu: fotos ilegíveis — refaça a captura. Check-in permanece; substitua as fotos que não conferem.',
};

export function mensagemDevolucaoPortaria(motivo: string, fotosRefazer?: string[]): string {
  const nomes = (fotosRefazer ?? [])
    .map((tipo) => rotuloFotoVistoria(tipo))
    .filter(Boolean);
  if (nomes.length) {
    return `Gate devolveu para refazer: ${nomes.join(', ')}. Check-in e as demais fotos permanecem.`;
  }
  if ((MOTIVOS_DEVOLVER_PORTARIA as readonly string[]).includes(motivo)) {
    return MSG_DEVOLVER_PORTARIA[motivo as MotivoDevolverPortaria];
  }
  return 'Gate devolveu para complementar a vistoria fotográfica. Check-in permanece.';
}

export function mergeFotosVistoria<T extends { tipo?: string }>(
  existentes: T[] | null | undefined,
  novas: T[] | null | undefined,
): T[] {
  const map = new Map<string, T>();
  for (const foto of existentes ?? []) {
    const tipo = String(foto.tipo ?? '').trim();
    if (tipo) map.set(tipo, foto);
  }
  for (const foto of novas ?? []) {
    const tipo = String(foto.tipo ?? '').trim();
    if (tipo) map.set(tipo, foto);
  }
  return [...map.values()];
}

function primeiroOcr(value: string | null | undefined): {
  valor: string;
  origem: OrigemCaptura;
} {
  const v = String(value ?? '').trim();
  if (!v || v === '—') return { valor: '', origem: 'AUSENTE' };
  return { valor: v, origem: 'OCR' };
}

export function compararCampo(
  campo: ConferenciaCampoId,
  solicitadoRaw: string,
  capturadoRaw: string,
  origemCaptura: OrigemCaptura,
): ConferenciaCampo {
  const normalizar =
    campo === 'container'
      ? normalizeContainer
      : campo === 'cpf'
        ? normalizeCpf
        : campo === 'motorista'
          ? normalizeNome
          : campo === 'lacre'
            ? normalizeLacre
            : normalizePlaca;

  const solicitado = String(solicitadoRaw ?? '').trim();
  const capturado = String(capturadoRaw ?? '').trim();
  const solN = normalizar(solicitado);
  const capN = normalizar(capturado);

  let status: ConferenciaStatus = 'SEM_CAPTURA';
  if (!solN || !capN) status = 'SEM_CAPTURA';
  else if (solN === capN) status = 'CONFERE';
  else status = 'DIVERGENTE';

  return {
    campo,
    label: LABELS[campo],
    solicitado: solicitado || '—',
    capturado: capturado || '—',
    origemCaptura,
    status,
  };
}

export function buildConferencia(input: {
  solicitado: {
    container: string;
    placa?: string;
    placaCavalo?: string;
    placaCarreta?: string;
    placaCarreta02?: string;
    lacre?: string;
    motorista: string;
    cpf: string;
    tipoCaminhao?: string;
  };
  portaria?: {
    placa?: string;
    motorista?: string;
    cpf?: string;
  };
  ocrContainer?: string | null;
  ocrPlaca?: string | null;
  ocrPlacaCavalo?: string | null;
  ocrPlacaCarreta?: string | null;
  ocrPlacaCarreta02?: string | null;
  ocrLacre?: string | null;
}): { itens: ConferenciaCampo[]; resumo: ConferenciaResumo } {
  const placaCavalo = input.solicitado.placaCavalo || input.solicitado.placa || '';
  const ocrCavalo = input.ocrPlacaCavalo || input.ocrPlaca;
  const rodotrem = isRodotrem(input.solicitado.tipoCaminhao);

  const pares: Array<{
    campo: ConferenciaCampoId;
    solicitado: string;
    ocr?: string | null;
  }> = [
    { campo: 'container', solicitado: input.solicitado.container, ocr: input.ocrContainer },
    { campo: 'placaCavalo', solicitado: placaCavalo, ocr: ocrCavalo },
    { campo: 'placaCarreta', solicitado: input.solicitado.placaCarreta ?? '', ocr: input.ocrPlacaCarreta },
    { campo: 'lacre', solicitado: input.solicitado.lacre ?? '', ocr: input.ocrLacre },
  ];
  if (rodotrem) {
    pares.splice(3, 0, {
      campo: 'placaCarreta02',
      solicitado: input.solicitado.placaCarreta02 ?? '',
      ocr: input.ocrPlacaCarreta02,
    });
  }

  const itens = pares.map((p) => {
    const cap = primeiroOcr(p.ocr);
    return compararCampo(p.campo, p.solicitado, cap.valor, cap.origem);
  });

  const resumo: ConferenciaResumo = {
    conferem: itens.filter((i) => i.status === 'CONFERE').length,
    divergentes: itens.filter((i) => i.status === 'DIVERGENTE').length,
    semCaptura: itens.filter((i) => i.status === 'SEM_CAPTURA').length,
  };

  return { itens, resumo };
}

/** Gate tem a última palavra: campo que o operador confirmou/corrigiu deixa de bloquear a RIC. */
export function aplicarConfirmacaoGate(
  conferencia: { itens: ConferenciaCampo[]; resumo: ConferenciaResumo },
  confirmados: string[] | null | undefined,
): { itens: ConferenciaCampo[]; resumo: ConferenciaResumo } {
  const set = new Set((confirmados ?? []).map((c) => String(c)));
  if (set.size === 0) return conferencia;
  const itens = conferencia.itens.map((i) =>
    set.has(i.campo) && i.status !== 'CONFERE' ? { ...i, status: 'CONFERE' as const } : i,
  );
  return {
    itens,
    resumo: {
      conferem: itens.filter((i) => i.status === 'CONFERE').length,
      divergentes: itens.filter((i) => i.status === 'DIVERGENTE').length,
      semCaptura: itens.filter((i) => i.status === 'SEM_CAPTURA').length,
    },
  };
}

/**
 * Na conferência OCR o Gate só escolhe agendamento ou OCR — sem valor digitado.
 * `informado` já deve estar normalizado com a mesma função.
 */
export function origemValorConferenciaOcr(
  solicitado: string | null | undefined,
  capturado: string | null | undefined,
  informado: string,
  normalizar: (value: string | null | undefined) => string,
): 'ocr' | 'agendamento' | null {
  const next = normalizar(informado);
  if (!next) return null;
  const ocr = normalizar(capturado === '—' ? '' : capturado);
  const agenda = normalizar(solicitado === '—' ? '' : solicitado);
  if (ocr && next === ocr) return 'ocr';
  if (agenda && next === agenda) return 'agendamento';
  return null;
}

export function colunaControle(state: string, atualizadoEm?: Date | string | null): ControleColuna | null {
  if (state === 'CHECKIN_PORTARIA' || state === 'VISTORIA_FOTOGRAFICA') return 'NA_PORTARIA';
  if (state === 'AGUARDANDO_RECONFIRMACAO') return 'A_CONFERIR';
  if (state === 'RECONFIRMADA' || state === 'RIC_GERADO') return 'RIC_PENDENTE';
  if (state === 'LIBERADA_OPERACAO') {
    if (!atualizadoEm) return 'LIBERADO';
    const d = atualizadoEm instanceof Date ? atualizadoEm : new Date(atualizadoEm);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return d >= start ? 'LIBERADO' : null;
  }
  return null;
}

export function rotuloTipoOperacao(tipo: string | null | undefined): string {
  const map: Record<string, string> = {
    SOLICITAR_BAIXA: 'Baixa',
    SOLICITAR_COLETA: 'Coleta',
    SOLICITAR_IMPORTACAO_COLETA_DEPOT: 'Coleta depot',
    SOLICITAR_EXPORTACAO_ENTREGA_DEPOT: 'Entrega depot',
    SOLICITAR_TRANSFERENCIA: 'Transferência',
    SOLICITAR_INSPECAO: 'Inspeção',
    SOLICITAR_REPARO: 'Reparo',
    GATE_IN: 'Entrada',
    GATE_OUT: 'Saída',
  };
  const key = String(tipo ?? '').trim();
  if (!key) return '—';
  return map[key] ?? key.replace(/_/g, ' ');
}

export function rotuloTipoCaminhao(tipo: string | null | undefined): string {
  const key = String(tipo ?? '').toUpperCase();
  if (key === 'RODOTREM') return 'Rodotrem';
  if (key === 'LS') return 'LS';
  return key || '—';
}
