/**
 * E2E manual do fluxo operacional Gate (portaria → vistoria → reconfirmação → RIC → operação).
 * Uso: npx ts-node scripts/test-operacao-fluxo-e2e.ts
 */
import { disconnectPrisma, getPrisma } from './seed-utils';

const API = process.env.API_BASE ?? 'http://localhost:3001';
const ADMIN_DOC = '39053344705';
const ADMIN_PWD = 'Admin@123';
const GATE_DOC =
  process.env.SEED_QA_OPERADOR_GATE_CPF ??
  process.env.SEED_QA_OPERADOR_GATE_CPF_CNPJ ??
  '15350946056';
const GATE_PWD = process.env.SEED_QA_OPERADOR_GATE_PASSWORD ?? 'OpsGate@QA2026';
const PORT_DOC =
  process.env.SEED_QA_OPERADOR_CPF ??
  process.env.SEED_QA_OPERADOR_CPF_CNPJ ??
  '12345678909';
const PORT_PWD = process.env.SEED_QA_OPERADOR_PASSWORD ?? 'OpsPrt@QA2026';

const MINIMAL_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

type LoginOut = { accessToken: string; user: { id: string; role: string } };

async function login(documento: string, password: string): Promise<LoginOut> {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documento, password }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Login falhou (${res.status}): ${text}`);
  return JSON.parse(text) as LoginOut;
}

async function apiPdf(token: string, path: string) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/pdf' },
  });
  const buffer = Buffer.from(await res.arrayBuffer());
  if (!res.ok) {
    throw new Error(`POST ${path} → ${res.status}: ${buffer.toString('utf8').slice(0, 200)}`);
  }
  return {
    contentType: res.headers.get('content-type') ?? '',
    buffer,
  };
}

async function api<T>(
  token: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init?.method ?? 'GET'} ${path} → ${res.status}: ${text}`);
  return text ? (JSON.parse(text) as T) : ({} as T);
}

function step(n: number, msg: string) {
  console.log(`\n[${n}] ${msg}`);
}

async function ensureAnexo(solicitacaoId: string) {
  const prisma = getPrisma();
  const count = await prisma.solicitacaoAnexo.count({ where: { solicitacaoId } });
  if (count > 0) return;
  await prisma.solicitacaoAnexo.create({
    data: {
      solicitacaoId,
      filename: 'seed-cte-e2e.pdf',
      mimeType: 'application/pdf',
      size: 2048,
      urlS3: 'local://seed/e2e-cte.pdf',
      expiresAt: new Date(Date.now() + 7 * 86400000),
    },
  });
  console.log('   + anexo fake criado para aprovação');
}

async function main() {
  console.log('=== E2E Fluxo Operacional Gate ===');
  console.log(`API: ${API}`);

  const health = await fetch(`${API}/health`);
  if (!health.ok) throw new Error(`Backend indisponível (${health.status})`);

  const prisma = getPrisma();
  let sol = await prisma.solicitacao.findFirst({
    where: {
      protocolo: { startsWith: 'SEED-GATE-AUTH-' },
      status: { in: ['PENDENTE', 'EM_ANALISE'] },
      deletedAt: null,
    },
    orderBy: { protocolo: 'asc' },
  });
  if (!sol) {
    throw new Error('Nenhuma SEED-GATE-AUTH pendente — rode npm run seed:clean');
  }
  await ensureAnexo(sol.id);

  const admin = await login(ADMIN_DOC, ADMIN_PWD);
  step(1, `Login Admin OK (${admin.user.role})`);

  const approved = await api<{
    id: string;
    protocolo: string;
    qrToken?: string;
    operacaoFluxoEstado?: string;
  }>(admin.accessToken, `/v2/solicitacoes/${sol.id}/aprovar`, { method: 'POST' });
  console.log(`   Aprovado: ${approved.protocolo} | QR: ${approved.qrToken ? 'sim' : 'NÃO'}`);
  if (!approved.qrToken) throw new Error('qrToken ausente na aprovação');

  const protocolo = approved.protocolo;

  const port = await login(PORT_DOC, PORT_PWD);
  step(2, `Login Portaria OK`);

  const op0 = await api<{ state: string }>(port.accessToken, `/v2/gate/operacoes/${protocolo}`);
  console.log(`   Estado inicial: ${op0.state}`);
  if (op0.state !== 'AGUARDANDO_CHEGADA') {
    throw new Error(`Esperado AGUARDANDO_CHEGADA, veio ${op0.state}`);
  }

  const busca = await api<{ items: Array<{ protocolo: string }> }>(
    port.accessToken,
    `/v2/gate/aguardando-chegada?search=${encodeURIComponent(protocolo)}`,
  );
  if (!busca.items.some((i) => i.protocolo === protocolo)) {
    throw new Error('Busca aguardando-chegada não retornou a operação');
  }
  console.log('   Busca aguardando-chegada OK');

  const op1 = await api<{ state: string }>(
    port.accessToken,
    `/v2/gate/operacoes/${protocolo}/checkin`,
    { method: 'POST' },
  );
  console.log(`   Check-in → ${op1.state}`);
  if (op1.state !== 'CHECKIN_PORTARIA') throw new Error('Check-in não mudou para CHECKIN_PORTARIA');

  const ocr = await api<{ texto: string; ocrMatch: boolean; confianca: number; provider: string; sucesso: boolean }>(
    port.accessToken,
    '/v2/ocr/processar',
    {
      method: 'POST',
      body: JSON.stringify({ imagem: MINIMAL_PNG, tipo: 'CONTAINER', esperado: 'MSCU1001137' }),
    },
  );
  console.log(
    `   OCR container: ${ocr.texto || '(vazio)'} match=${ocr.ocrMatch} conf=${Math.round((ocr.confianca ?? 0) * 100)}% provider=${ocr.provider}`,
  );

  const fotos = [
    'CONTAINER_OCR',
    'PLACA_OCR',
    'LADO_FRONTAL',
    'LADO_TRASEIRO',
    'LADO_DIREITO',
    'LADO_ESQUERDO',
  ].map((tipo) => ({
    tipo,
    imagem: MINIMAL_PNG,
    ...(tipo.includes('OCR') ? { ocrResult: 'TEST', ocrMatch: true } : {}),
  }));

  const op2 = await api<{ state: string }>(
    port.accessToken,
    `/v2/gate/operacoes/${protocolo}/vistoria`,
    {
      method: 'POST',
      body: JSON.stringify({ fotos, avarias: [] }),
    },
  );
  console.log(`   Vistoria enviada → ${op2.state}`);
  if (op2.state !== 'AGUARDANDO_RECONFIRMACAO') {
    throw new Error(`Esperado AGUARDANDO_RECONFIRMACAO, veio ${op2.state}`);
  }

  const gate = await login(GATE_DOC, GATE_PWD);
  step(3, `Login Gate OK — reconfirmação/RIC/operação`);
  const checklist = {
    containerConfere: true,
    tipoConfere: true,
    situacaoConfere: true,
    placaConfere: true,
    motoristaConfere: true,
    fotosOk: true,
    semAvariasCriticas: true,
  };
  const op3 = await api<{ state: string }>(
    gate.accessToken,
    `/v2/gate/operacoes/${protocolo}/reconfirmar`,
    { method: 'POST', body: JSON.stringify({ checklist }) },
  );
  console.log(`   Reconfirmado → ${op3.state}`);
  if (op3.state !== 'RECONFIRMADA') throw new Error('Reconfirmação falhou');

  step(4, 'RIC + assinatura');
  await api(gate.accessToken, `/v2/gate/operacoes/${protocolo}/assinatura`, {
    method: 'POST',
    body: JSON.stringify({ assinatura: MINIMAL_PNG }),
  });
  const ric = await apiPdf(gate.accessToken, `/v2/gate/operacoes/${protocolo}/ric-pdf`);
  if (!ric.contentType.includes('application/pdf')) {
    throw new Error(`RIC Content-Type inválido: ${ric.contentType}`);
  }
  if (!ric.buffer.subarray(0, 4).equals(Buffer.from('%PDF'))) {
    throw new Error('RIC não é PDF binário válido');
  }
  console.log(`   RIC PDF: ${ric.buffer.length} bytes, Content-Type: ${ric.contentType}`);

  const op4 = await api<{ state: string }>(
    gate.accessToken,
    `/v2/gate/operacoes/${protocolo}/liberar-operacao`,
    { method: 'POST' },
  );
  console.log(`   Liberada → ${op4.state}`);
  if (op4.state !== 'LIBERADA_OPERACAO') throw new Error('Liberação falhou');

  step(5, 'Operador empilhadeira');
  const op5 = await api<{ state: string }>(
    gate.accessToken,
    `/v2/gate/operacoes/${protocolo}/iniciar`,
    { method: 'POST', body: JSON.stringify({}) },
  );
  console.log(`   Iniciada → ${op5.state}`);
  if (op5.state !== 'EM_OPERACAO') throw new Error('Início operação falhou');

  const op6 = await api<{ state: string }>(
    gate.accessToken,
    `/v2/gate/operacoes/${protocolo}/concluir`,
    { method: 'POST' },
  );
  console.log(`   Concluída → ${op6.state}`);
  if (op6.state !== 'CONCLUIDA') throw new Error('Conclusão falhou');

  const reconfCount = await api<{ count: number }>(
    gate.accessToken,
    '/v2/gate/reconfirmacoes/count',
  );
  console.log(`\n✅ FLUXO COMPLETO OK — protocolo ${protocolo}`);
  console.log(`   Reconfirmações pendentes agora: ${reconfCount.count}`);
}

main()
  .catch((e) => {
    console.error('\n❌ FALHA E2E:', e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(async () => {
    await disconnectPrisma();
  });
