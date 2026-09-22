export type AuditMudancaUi = {
  campo: string;
  label: string;
  antes: string;
  depois: string;
};

const CAMPOS_IGNORADOS =
  /^(password|senha|token|hash|secret|gerentetoken|request|deltas|ator|portal|tipo|rota|v2|usuario|fingerprint|ua|ip|record|origem|body|query|params|ok|response|metodoHttp|resultado|clienteId|cnpj|operadorEmail|pessoaId|portalPapel|id|createdAt|updatedAt|deletedAt|verificadoEm|solicitacaoId|papeis)$/i;

function texto(value: unknown): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'sim' : 'não';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  try {
    const t = JSON.stringify(value);
    return t.length > 120 ? `${t.slice(0, 118)}…` : t;
  } catch {
    return '—';
  }
}

function rotuloCampo(campo: string): string {
  const known: Record<string, string> = {
    status: 'Status',
    placaCavalo: 'Placa cavalo',
    placaCarreta01: 'Placa carreta 01',
    placaCarreta02: 'Placa carreta 02',
    nomeMotorista: 'Motorista',
    cpfMotorista: 'CPF do motorista',
    dataRef: 'Data do agendamento',
    turno: 'Turno',
    protocolo: 'Protocolo',
    valorTotal: 'Valor',
    valorAtualizado: 'Valor atualizado',
    statusPagamento: 'Pagamento',
    booking: 'Booking',
    processo: 'Processo',
    navio: 'Navio',
    lacre: 'Lacre',
    tipoOperacao: 'Tipo de operação',
  };
  if (known[campo]) return known[campo];
  return campo
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());
}

function unwrapPayload(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const o = value as Record<string, unknown>;
  if (o.record && typeof o.record === 'object' && !Array.isArray(o.record)) {
    return o.record as Record<string, unknown>;
  }
  if (o.body && typeof o.body === 'object' && !Array.isArray(o.body)) {
    return o.body as Record<string, unknown>;
  }
  return o;
}

function deltasDe(payload: Record<string, unknown> | null): AuditMudancaUi[] {
  const raw = payload?.deltas;
  if (!Array.isArray(raw)) return [];
  const out: AuditMudancaUi[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const d = item as Record<string, unknown>;
    const campo = String(d.campo ?? d.field ?? '').trim();
    if (!campo || CAMPOS_IGNORADOS.test(campo)) continue;
    const antes = texto(d.antes ?? d.before);
    const depois = texto(d.depois ?? d.after);
    if (antes === depois) continue;
    out.push({
      campo,
      label: String(d.label ?? rotuloCampo(campo)),
      antes,
      depois,
    });
  }
  return out;
}

function flatten(obj: Record<string, unknown>, prefix = ''): Array<[string, unknown]> {
  const rows: Array<[string, unknown]> = [];
  for (const [k, v] of Object.entries(obj)) {
    if (CAMPOS_IGNORADOS.test(k)) continue;
    if (k === 'pessoaResponsavel' || k === 'ator') continue;
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) {
      rows.push(...flatten(v as Record<string, unknown>, path));
    } else {
      rows.push([path, v]);
    }
  }
  return rows;
}

/** Extrai pares "como estava → como ficou" de payloads de auditoria. */
export function extractAuditMudancas(antes: unknown, depois: unknown): AuditMudancaUi[] {
  const a = unwrapPayload(antes);
  const b = unwrapPayload(depois);
  const fromDeltas = deltasDe(b).length ? deltasDe(b) : deltasDe(a);
  if (fromDeltas.length) return fromDeltas.slice(0, 24);

  const mapA = new Map(a ? flatten(a) : []);
  const mapB = new Map(b ? flatten(b) : []);
  const keys = new Set([...mapA.keys(), ...mapB.keys()]);
  const out: AuditMudancaUi[] = [];
  for (const campo of keys) {
    const antesTxt = texto(mapA.has(campo) ? mapA.get(campo) : undefined);
    const depoisTxt = texto(mapB.has(campo) ? mapB.get(campo) : undefined);
    if (antesTxt === depoisTxt) continue;
    const leaf = campo.includes('.') ? campo.slice(campo.lastIndexOf('.') + 1) : campo;
    out.push({
      campo,
      label: rotuloCampo(leaf),
      antes: mapA.has(campo) ? antesTxt : '—',
      depois: mapB.has(campo) ? depoisTxt : '—',
    });
    if (out.length >= 24) break;
  }
  return out;
}
