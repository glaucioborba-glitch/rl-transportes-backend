import { proximoSk } from './datahub-dw.catalog';
import type { NomeDim, NomeFato } from './datahub.types';
import type { RawExtractBundle } from './datahub-extract.types';

export interface DwBuildResult {
  fatos: Partial<Record<NomeFato, Record<string, unknown>[]>>;
  dimensoes: Partial<Record<NomeDim, Record<string, unknown>[]>>;
  linhasTotal: number;
}

function skTempo(d: Date, idx: number): Record<string, unknown> {
  return {
    sk_tempo: proximoSk('t', idx),
    data: d.toISOString().slice(0, 10),
    ano: d.getUTCFullYear(),
    mes: d.getUTCMonth() + 1,
    dia: d.getUTCDate(),
    dia_semana: d.getUTCDay(),
  };
}

/** Transforma bundle RAW → linhas de fatos/dimensões estilo Kimball (simulação). */
export function construirStarSchema(raw: RawExtractBundle): DwBuildResult {
  const dimClientes: Record<string, unknown>[] = [];
  const mapClienteSk = new Map<string, number>();
  let iC = 1;
  for (const c of raw.clientes) {
    mapClienteSk.set(c.id, iC);
    dimClientes.push({
      sk_cliente: proximoSk('c', iC),
      cliente_natural_key: c.id,
      nome: c.nome,
      tipo_documento: c.tipo,
    });
    iC++;
  }

  const diasUnicos = new Map<string, Date>();
  const pushDia = (dt: Date) => {
    const k = dt.toISOString().slice(0, 10);
    if (!diasUnicos.has(k)) diasUnicos.set(k, new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate())));
  };
  for (const s of raw.solicitacoes) {
    pushDia(s.createdAt);
    pushDia(s.updatedAt);
  }
  for (const f of raw.faturamentos) pushDia(f.createdAt);
  for (const b of raw.boletos) pushDia(b.vencimento);
  for (const n of raw.nfs) pushDia(n.createdAt);
  let iT = 1;
  const dimTempo = [...diasUnicos.values()]
    .sort((a, b) => a.getTime() - b.getTime())
    .map((d) => skTempo(d, iT++));
  const mapTempoSk = new Map<string, number>();
  dimTempo.forEach((row, idx) => mapTempoSk.set(String(row.data), idx + 1));

  let iCol = 1;
  const dimColaboradores = raw.usuariosInternos.map((u) => ({
    sk_colaborador: proximoSk('u', iCol++),
    email_hash_proxy: `h_${u.id.slice(0, 8)}`,
    role: u.role,
  }));

  const dimTurnos: Record<string, unknown>[] = [
    { sk_turno: proximoSk('tr', 1), codigo: 'A', janela_horario: '06-14' },
    { sk_turno: proximoSk('tr', 2), codigo: 'B', janela_horario: '14-22' },
    { sk_turno: proximoSk('tr', 3), codigo: 'C', janela_horario: '22-06' },
  ];

  const fSolic: Record<string, unknown>[] = [];
  const fGate: Record<string, unknown>[] = [];
  const fPatio: Record<string, unknown>[] = [];
  const fSaida: Record<string, unknown>[] = [];

  for (const s of raw.solicitacoes) {
    const skC = mapClienteSk.get(s.clienteId) ?? 1;
    const skT = mapTempoSk.get(s.createdAt.toISOString().slice(0, 10)) ?? 1;
    fSolic.push({
      sk_fato: proximoSk('fs', fSolic.length + 1),
      fk_cliente: proximoSk('c', skC),
      fk_tempo: proximoSk('t', skT),
      protocolo: s.protocolo,
      status: s.status,
      qt_unidades: s.qtUnidades,
      flag_stage_portaria: s.hasPortaria ? 1 : 0,
      flag_stage_gate: s.hasGate ? 1 : 0,
      flag_stage_patio: s.hasPatio ? 1 : 0,
      flag_stage_saida: s.hasSaida ? 1 : 0,
    });
    if (s.hasGate) {
      fGate.push({
        sk_fato: proximoSk('fg', fGate.length + 1),
        fk_cliente: proximoSk('c', skC),
        fk_tempo: proximoSk('t', skT),
        solicitacao_id: s.id,
        flag_ric_assinado: s.gateRicAssinado ? 1 : 0,
      });
    }
    if (s.hasPatio) {
      fPatio.push({
        sk_fato: proximoSk('fp', fPatio.length + 1),
        fk_cliente: proximoSk('c', skC),
        fk_tempo: proximoSk('t', skT),
        solicitacao_id: s.id,
        slot_ocupado: 1,
      });
    }
    if (s.hasSaida && s.saidaEm) {
      const mins = Math.max(
        0,
        Math.round((s.saidaEm.getTime() - s.createdAt.getTime()) / 60000),
      );
      fSaida.push({
        sk_fato: proximoSk('fz', fSaida.length + 1),
        fk_cliente: proximoSk('c', skC),
        fk_tempo: proximoSk('t', skT),
        solicitacao_id: s.id,
        duracao_minutos_proxy: mins,
      });
    }
  }

  const fFat: Record<string, unknown>[] = raw.faturamentos.map((f, i) => {
    const skC = mapClienteSk.get(f.clienteId) ?? 1;
    const skT = mapTempoSk.get(f.createdAt.toISOString().slice(0, 10)) ?? 1;
    return {
      sk_fato: proximoSk('ff', i + 1),
      fk_cliente: proximoSk('c', skC),
      fk_tempo: proximoSk('t', skT),
      periodo: f.periodo,
      valor_total: f.valorTotal,
      qt_itens: f.qtItens,
    };
  });

  const fBol: Record<string, unknown>[] = raw.boletos.map((b, i) => {
    const skC = mapClienteSk.get(b.clienteId) ?? 1;
    const skT = mapTempoSk.get(b.vencimento.toISOString().slice(0, 10)) ?? 1;
    const vencido =
      b.statusPagamento !== 'PAGO' && b.vencimento.getTime() < Date.now() ? 1 : 0;
    return {
      sk_fato: proximoSk('fb', i + 1),
      fk_cliente: proximoSk('c', skC),
      fk_tempo: proximoSk('t', skT),
      valor_boleto: b.valor,
      flag_vencido: vencido,
    };
  });

  const fNf: Record<string, unknown>[] = raw.nfs.map((n, i) => {
    const skC = mapClienteSk.get(n.clienteId) ?? 1;
    const skT = mapTempoSk.get(n.createdAt.toISOString().slice(0, 10)) ?? 1;
    return {
      sk_fato: proximoSk('fn', i + 1),
      fk_cliente: proximoSk('c', skC),
      fk_tempo: proximoSk('t', skT),
      faturamento_id: n.faturamentoId,
      flag_status_ipm: n.statusIpm,
    };
  });

  const custoMedio = 4800;
  const porRole = new Map<string, number>();
  for (const u of raw.usuariosInternos) porRole.set(u.role, (porRole.get(u.role) ?? 0) + 1);
  const fRh: Record<string, unknown>[] = [...porRole.entries()].map(([role, n], i) => ({
    sk_fato: proximoSk('fr', i + 1),
    fk_tempo: proximoSk('t', 1),
    fk_turno: proximoSk('tr', (i % 3) + 1),
    papel: role,
    headcount: n,
    custo_medio_proxy: custoMedio * n,
  }));

  const linhasTotal =
    fSolic.length +
    fGate.length +
    fPatio.length +
    fSaida.length +
    fFat.length +
    fBol.length +
    fNf.length +
    fRh.length +
    dimClientes.length +
    dimTempo.length;

  return {
    fatos: {
      FATO_Solicitacoes: fSolic,
      FATO_Gate: fGate,
      FATO_Patio: fPatio,
      FATO_Saida: fSaida,
      FATO_Faturamento: fFat,
      FATO_Boletos: fBol,
      FATO_NFSe: fNf,
      FATO_RH_Folha: fRh,
    },
    dimensoes: {
      DIM_Clientes: dimClientes,
      DIM_Tempo: dimTempo,
      DIM_Colaboradores: dimColaboradores,
      DIM_Turnos: dimTurnos,
    },
    linhasTotal,
  };
}
