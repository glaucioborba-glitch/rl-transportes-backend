import { DEFAULT_EMPRESA_OPERADORA } from '../tenant/empresa-operadora.types';
import { generateSaldoPdf } from './patio-saldo-pdf';
import {
  buildSaldoXml,
  diasNoPatio,
  filtrarSaldoUnidades,
  xmlEscape,
  type PatioSaldoUnidade,
} from './patio-saldo.util';

const base: PatioSaldoUnidade = {
  id: 'u1',
  unidadeIso: 'TEMU6079348',
  status: 'SEPARADO',
  refrigerado: false,
  cliente: 'ACME & Cia',
  clienteId: 'c1',
  baia: null,
  entradaEm: new Date(Date.now() - 5 * 86_400_000).toISOString(),
  processoNumero: 12,
  processo: 'PROC-44',
  booking: 'BKG-9',
  navio: 'MSC LORETO',
  situacao: 'CHEIO',
  tamanho: '40',
  tamanhoLabel: "40'",
};

describe('patio-saldo.util', () => {
  it('lista unidade sem baia e filtra por busca/tipo/dias', () => {
    const reefer: PatioSaldoUnidade = {
      ...base,
      id: 'u2',
      unidadeIso: 'RELU1234567',
      refrigerado: true,
      baia: 'A01',
      cliente: 'Outro',
      booking: 'BKG-REEFER',
      processo: 'PROC-88',
      navio: 'CMA CGM',
      situacao: 'VAZIO',
      tamanho: '20',
      tamanhoLabel: "20'",
      entradaEm: new Date().toISOString(),
    };
    const all = [base, reefer];
    expect(filtrarSaldoUnidades(all, { baia: 'SEM' })).toEqual([base]);
    expect(filtrarSaldoUnidades(all, { baia: 'A' })).toEqual([reefer]);
    expect(filtrarSaldoUnidades(all, { tipo: 'REEFER' })).toEqual([reefer]);
    expect(filtrarSaldoUnidades(all, { q: 'acme' })).toEqual([base]);
    expect(filtrarSaldoUnidades(all, { q: 'bkg-9' })).toEqual([base]);
    expect(filtrarSaldoUnidades(all, { situacao: 'VAZIO' })).toEqual([reefer]);
    expect(filtrarSaldoUnidades(all, { tamanho: '40' })).toEqual([base]);
    expect(filtrarSaldoUnidades(all, { diasMin: 3 }).map((u) => u.id)).toEqual(['u1']);
  });

  it('diasNoPatio arredonda para baixo a partir da entrada', () => {
    expect(diasNoPatio(new Date(Date.now() - 3.9 * 86_400_000).toISOString())).toBe(3);
    expect(diasNoPatio('')).toBe(0);
  });

  it('XML inclui unidade sem baia e escapa caracteres', () => {
    const xml = buildSaldoXml({
      geradoEm: '2026-09-11T12:00:00.000Z',
      empresa: { nome: 'RL', razaoSocial: 'RL Transportes', cnpj: '12345678000199' },
      lotacaoTotal: 1,
      capacidadeTotal: 0,
      reefers: 0,
      semBaia: 1,
      filtros: { q: 'acme' },
      unidades: [base],
    });
    expect(xml).toContain('<iso>TEMU6079348</iso>');
    expect(xml).toContain('<baia></baia>');
    expect(xml).toContain('<cliente>ACME &amp; Cia</cliente>');
    expect(xml).toContain('<processo>PROC-44</processo>');
    expect(xml).toContain('<booking>BKG-9</booking>');
    expect(xml).toContain('<navio>MSC LORETO</navio>');
    expect(xml).toContain('<situacao>CHEIO</situacao>');
    expect(xml).toContain(`<tamanho>${xmlEscape("40'")}</tamanho>`);
    expect(xml).not.toContain('<protocolo>');
    expect(xml).toContain(xmlEscape('acme'));
  });

  it('PDF com timbre começa com cabeçalho %PDF', async () => {
    const buf = await generateSaldoPdf({
      geradoEm: new Date().toISOString(),
      empresa: {
        ...DEFAULT_EMPRESA_OPERADORA,
        razaoSocial: 'RL Transportes Ltda',
        nomeFantasia: 'RL Transportes',
        cnpj: '12345678000199',
        logradouro: 'Av. Teste',
        numero: '10',
        cidade: 'Itajaí',
        uf: 'SC',
      },
      lotacaoTotal: 1,
      capacidadeTotal: 0,
      reefers: 0,
      semBaia: 1,
      filtros: {},
      unidades: [base],
    });
    expect(buf.subarray(0, 4).toString('utf8')).toBe('%PDF');
    expect(buf.length).toBeGreaterThan(400);
  });
});
