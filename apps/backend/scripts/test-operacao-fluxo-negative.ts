/**
 * Testes negativos do fluxo operacional.
 */
import { disconnectPrisma, getPrisma } from './seed-utils';

const API = 'http://localhost:3001';
const ADMIN = { documento: '39053344705', password: 'Admin@123' };
const GATE = { documento: '15350946056', password: 'OpsGate@QA2026' };
const PORT = { documento: '12345678909', password: 'OpsPrt@QA2026' };

async function login(creds: { documento: string; password: string }) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(creds),
  });
  const j = (await res.json()) as { accessToken: string };
  return j.accessToken;
}

async function api(token: string, path: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  return { status: res.status, body: await res.text() };
}

async function main() {
  const prisma = getPrisma();
  const failures: string[] = [];
  const ok: string[] = [];

  function expect(label: string, cond: boolean, detail?: string) {
    if (cond) ok.push(`✓ ${label}`);
    else failures.push(`✗ ${label}${detail ? `: ${detail}` : ''}`);
  }

  const adminToken = await login(ADMIN);
  const gateToken = await login(GATE);
  const portToken = await login(PORT);

  // 1) Gate não pode aprovar (403 esperado)
  const sol = await prisma.solicitacao.findFirst({
    where: { protocolo: 'SEED-GATE-AUTH-002', status: { in: ['PENDENTE', 'EM_ANALISE'] } },
  });
  if (sol) {
    await prisma.solicitacaoAnexo.deleteMany({ where: { solicitacaoId: sol.id } }).catch(() => undefined);
    await prisma.solicitacaoAnexo.create({
      data: {
        solicitacaoId: sol.id,
        filename: 't.pdf',
        mimeType: 'application/pdf',
        size: 100,
        urlS3: 'local://t',
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    const r = await api(gateToken, `/v2/solicitacoes/${sol.id}/aprovar`, { method: 'POST' });
    expect('OPERADOR_GATE bloqueado na aprovação', r.status === 403, `status=${r.status}`);
  }

  // 2) Check-in sem aprovação
  const solPending = await prisma.solicitacao.findFirst({
    where: { protocolo: 'SEED-GATE-AUTH-003', status: 'PENDENTE' },
  });
  if (solPending) {
    const r = await api(portToken, `/v2/gate/operacoes/${solPending.protocolo}/checkin`, { method: 'POST' });
    expect('Check-in bloqueado sem aprovação', r.status === 400, r.body.slice(0, 120));
  }

  // 3) Transição inválida: concluir sem iniciar
  await prisma.solicitacao.update({
    where: { protocolo: 'SEED-GATE-AUTH-004' },
    data: {
      status: 'AGUARDANDO_GATE_IN',
      operacaoFluxoEstado: 'LIBERADA_OPERACAO',
      operacaoFluxoJson: {},
    },
  });
  const r3 = await api(gateToken, '/v2/gate/operacoes/SEED-GATE-AUTH-004/concluir', { method: 'POST' });
  expect('Concluir sem EM_OPERACAO bloqueado', r3.status === 400, r3.body.slice(0, 120));

  // 4) Rejeição na reconfirmação
  await prisma.solicitacao.update({
    where: { protocolo: 'SEED-GATE-AUTH-005' },
    data: {
      status: 'EM_EXECUCAO',
      operacaoFluxoEstado: 'AGUARDANDO_RECONFIRMACAO',
      operacaoFluxoJson: {
        vistoria: { fotos: [{ tipo: 'CONTAINER_OCR', imagem: 'x' }], avarias: [] },
      },
    },
  });
  const r4 = await api(gateToken, '/v2/gate/operacoes/SEED-GATE-AUTH-005/rejeitar', {
    method: 'POST',
    body: JSON.stringify({ motivo: 'CONTAINER_DIVERGENTE', etapa: 'RECONFIRMACAO' }),
  });
  expect('Rejeição na reconfirmação', r4.status === 201 || r4.status === 200, `status=${r4.status}`);
  const afterRej = await prisma.solicitacao.findUnique({ where: { protocolo: 'SEED-GATE-AUTH-005' } });
  expect('Estado REJEITADA após rejeitar', afterRej?.operacaoFluxoEstado === 'REJEITADA');

  // 5) Vistoria sem fotos obrigatórias
  await prisma.solicitacao.update({
    where: { protocolo: 'SEED-GATE-AUTH-006' },
    data: { status: 'AGUARDANDO_GATE_IN', operacaoFluxoEstado: 'CHECKIN_PORTARIA', operacaoFluxoJson: {} },
  });
  const r5 = await api(portToken, '/v2/gate/operacoes/SEED-GATE-AUTH-006/vistoria', {
    method: 'POST',
    body: JSON.stringify({ fotos: [{ tipo: 'CONTAINER_OCR', imagem: 'x' }], avarias: [] }),
  });
  expect('Vistoria incompleta bloqueada', r5.status === 400, r5.body.slice(0, 120));

  console.log('\n=== Testes negativos ===');
  ok.forEach((l) => console.log(l));
  if (failures.length) {
    console.log('\nFALHAS:');
    failures.forEach((l) => console.log(l));
    process.exit(1);
  }
  console.log('\n✅ Todos os testes negativos passaram');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => disconnectPrisma());
