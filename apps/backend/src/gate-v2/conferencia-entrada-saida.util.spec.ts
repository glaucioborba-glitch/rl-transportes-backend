import {
  aplicarConfirmacaoGate,
  buildConferencia,
  caboTomadaFotoObrigatoria,
  caboTomadaFotoPresente,
  colunaControle,
  compararCampo,
  isRodotrem,
  isTipoIsoTank,
  isTipoReefer,
  lacreFotoObrigatoria,
  lacreFotoPresente,
  mensagemDevolucaoPortaria,
  mergeFotosVistoria,
  removerFotosRefazer,
  fotosVistoriaObrigatoriasAusentes,
  tiposFotoVistoriaObrigatorias,
  origemValorConferenciaOcr,
  normalizeContainer,
  normalizeNome,
  normalizePlaca,
  rotuloTipoOperacao,
} from './conferencia-entrada-saida.util';

describe('conferencia-entrada-saida.util', () => {
  it('normaliza placa, ISO e nome', () => {
    expect(normalizePlaca('abc-1d23')).toBe('ABC1D23');
    expect(normalizeContainer(' MSCU 100113-7 ')).toBe('MSCU1001137');
    expect(normalizeNome('João  da  Silva')).toBe('JOAO DA SILVA');
  });

  it('marca CONFERE / DIVERGENTE / SEM_CAPTURA', () => {
    expect(compararCampo('placaCavalo', 'ABC1D23', 'abc-1d23', 'OCR').status).toBe('CONFERE');
    expect(compararCampo('placaCavalo', 'ABC1D23', 'XYZ9K88', 'OCR').status).toBe('DIVERGENTE');
    expect(compararCampo('placaCavalo', 'ABC1D23', '', 'AUSENTE').status).toBe('SEM_CAPTURA');
  });

  it('prioriza OCR da placa cavalo e inclui carreta/lacre', () => {
    const { itens } = buildConferencia({
      solicitado: {
        container: 'MSCU1001137',
        placa: 'ABC1D23',
        placaCarreta: 'XYZ9E87',
        lacre: 'LAC123',
        motorista: 'João Silva',
        cpf: '52998224725',
        tipoCaminhao: 'LS',
      },
      ocrContainer: 'MSCU1001137',
      ocrPlaca: 'XYZ9K88',
      ocrPlacaCarreta: 'XYZ9E87',
      ocrLacre: 'LAC123',
    });
    expect(itens.find((i) => i.campo === 'placaCavalo')?.status).toBe('DIVERGENTE');
    expect(itens.find((i) => i.campo === 'container')?.status).toBe('CONFERE');
    expect(itens.find((i) => i.campo === 'placaCarreta')?.status).toBe('CONFERE');
    expect(itens.find((i) => i.campo === 'lacre')?.status).toBe('CONFERE');
    expect(itens.find((i) => i.campo === 'placaCarreta02')).toBeUndefined();
    expect(itens.map((i) => i.campo)).toEqual([
      'container',
      'placaCavalo',
      'placaCarreta',
      'lacre',
    ]);
  });

  it('inclui placa carreta 02 só no rodotrem', () => {
    expect(isRodotrem('RODOTREM')).toBe(true);
    const { itens } = buildConferencia({
      solicitado: {
        container: 'MSCU1001137',
        placaCavalo: 'ABC1D23',
        placaCarreta: 'XYZ9E87',
        placaCarreta02: 'QWE8R76',
        lacre: 'LAC123',
        motorista: 'João Silva',
        cpf: '52998224725',
        tipoCaminhao: 'RODOTREM',
      },
      ocrPlacaCarreta02: 'QWE8R76',
    });
    expect(itens.find((i) => i.campo === 'placaCarreta02')?.status).toBe('CONFERE');
  });

  it('classifica a coluna da fila do Gate', () => {
    expect(colunaControle('AGUARDANDO_RECONFIRMACAO')).toBe('A_CONFERIR');
    expect(colunaControle('RIC_GERADO')).toBe('RIC_PENDENTE');
    expect(colunaControle('CHECKIN_PORTARIA')).toBe('NA_PORTARIA');
    expect(colunaControle('LIBERADA_OPERACAO', new Date())).toBe('LIBERADO');
    expect(colunaControle('CONCLUIDA')).toBeNull();
  });

  it('rotula baixa e coleta', () => {
    expect(rotuloTipoOperacao('SOLICITAR_BAIXA')).toBe('Baixa');
    expect(rotuloTipoOperacao('SOLICITAR_COLETA')).toBe('Coleta');
  });

  it('exige foto do lacre só em CHEIO, exceto IsoTank', () => {
    expect(lacreFotoObrigatoria('CHEIO', 'DRYDC')).toBe(true);
    expect(lacreFotoObrigatoria('CHEIO', 'dry-hc')).toBe(true);
    expect(lacreFotoObrigatoria('VAZIO', 'DRYDC')).toBe(false);
    expect(lacreFotoObrigatoria('CHEIO', 'ISOTANK')).toBe(false);
    expect(lacreFotoObrigatoria('CHEIO', 'TANK')).toBe(false);
    expect(isTipoIsoTank('iso tank')).toBe(true);
  });

  it('reconhece foto do lacre por tipo OCR, LACRE ou extra da portaria', () => {
    expect(lacreFotoPresente([{ tipo: 'LACRE_OCR', imagem: 'data:image/png' }])).toBe(true);
    expect(lacreFotoPresente([{ tipo: 'LACRE', imagem: 'data:image/png' }])).toBe(true);
    expect(lacreFotoPresente([{ tipo: 'LACRE_OCR', imagem: '  ' }])).toBe(false);
    expect(lacreFotoPresente([{ tipo: 'CONTAINER_OCR', imagem: 'x' }])).toBe(false);
    expect(lacreFotoPresente([], ['https://s3/lacre.jpg'])).toBe(true);
  });

  it('exige foto do cabo da tomada em reefer, ligado ou não', () => {
    expect(caboTomadaFotoObrigatoria('REEFER', false)).toBe(true);
    expect(caboTomadaFotoObrigatoria('REEFER', true)).toBe(true);
    expect(caboTomadaFotoObrigatoria('DRYDC', false)).toBe(false);
    expect(caboTomadaFotoObrigatoria('DRYDC', true)).toBe(true);
    expect(caboTomadaFotoObrigatoria('REEFERDRY')).toBe(false);
    expect(isTipoReefer('rf')).toBe(true);
    expect(caboTomadaFotoPresente([{ tipo: 'CABO_TOMADA', imagem: 'data:image/png' }])).toBe(true);
    expect(caboTomadaFotoPresente([{ tipo: 'LADO_FRONTAL', imagem: 'x' }])).toBe(false);
  });

  it('devolve à portaria com mensagem e preserva fotos já tiradas no merge', () => {
    expect(mensagemDevolucaoPortaria('FALTA_CABO_TOMADA')).toMatch(/cabo da tomada/);
    expect(mensagemDevolucaoPortaria('FOTOS_REFAZER', ['CABO_TOMADA', 'LADO_FRONTAL'])).toMatch(
      /Cabo da tomada/,
    );
    const merged = mergeFotosVistoria(
      [{ tipo: 'LADO_FRONTAL', imagem: 'frente' }],
      [{ tipo: 'CABO_TOMADA', imagem: 'cabo' }],
    );
    expect(merged).toEqual([
      { tipo: 'LADO_FRONTAL', imagem: 'frente' },
      { tipo: 'CABO_TOMADA', imagem: 'cabo' },
    ]);
    expect(removerFotosRefazer(merged, ['CABO_TOMADA']).map((f) => f.tipo)).toEqual(['LADO_FRONTAL']);
  });

  it('confirma no Gate um campo laranja e deixa de contar como divergente', () => {
    const base = buildConferencia({
      solicitado: {
        container: 'MSCU1001137',
        placaCavalo: 'ABC1D23',
        motorista: 'João',
        cpf: '52998224725',
      },
      ocrPlacaCavalo: 'ZZZ9K88',
    });
    expect(base.resumo.divergentes).toBe(1);
    const after = aplicarConfirmacaoGate(base, ['placaCavalo']);
    expect(after.itens.find((i) => i.campo === 'placaCavalo')?.status).toBe('CONFERE');
    expect(after.resumo.divergentes).toBe(0);
  });

  it('na conferência OCR só aceita o valor do agendamento ou o do OCR', () => {
    expect(origemValorConferenciaOcr('ABC1D23', 'XYZ9K88', 'XYZ9K88', normalizePlaca)).toBe('ocr');
    expect(origemValorConferenciaOcr('ABC1D23', 'XYZ9K88', 'abc-1d23', normalizePlaca)).toBe(
      'agendamento',
    );
    expect(origemValorConferenciaOcr('ABC1D23', 'XYZ9K88', 'QQQ9Q99', normalizePlaca)).toBeNull();
  });

  it('exige foto da placa da carreta na vistoria e a 02 só no rodotrem', () => {
    const base = [
      { tipo: 'CONTAINER_OCR', imagem: 'x' },
      { tipo: 'PLACA_OCR', imagem: 'x' },
      { tipo: 'LADO_FRONTAL', imagem: 'x' },
      { tipo: 'LADO_TRASEIRO', imagem: 'x' },
      { tipo: 'LADO_DIREITO', imagem: 'x' },
      { tipo: 'LADO_ESQUERDO', imagem: 'x' },
    ];
    expect(tiposFotoVistoriaObrigatorias('LS')).toContain('PLACA_CARRETA_OCR');
    expect(tiposFotoVistoriaObrigatorias('LS')).not.toContain('PLACA_CARRETA_02_OCR');
    expect(tiposFotoVistoriaObrigatorias('RODOTREM')).toContain('PLACA_CARRETA_02_OCR');
    expect(fotosVistoriaObrigatoriasAusentes(base, 'LS')).toEqual(['PLACA_CARRETA_OCR']);
    expect(
      fotosVistoriaObrigatoriasAusentes(
        [...base, { tipo: 'PLACA_CARRETA01_OCR', imagem: 'x' }],
        'LS',
      ),
    ).toEqual([]);
    expect(
      fotosVistoriaObrigatoriasAusentes(
        [...base, { tipo: 'PLACA_CARRETA_OCR', imagem: 'x' }],
        'RODOTREM',
      ),
    ).toEqual(['PLACA_CARRETA_02_OCR']);
  });
});
