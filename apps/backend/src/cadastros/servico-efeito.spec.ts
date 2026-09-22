import { PatioStatus, StatusContainerTarifa } from '@prisma/client';
import {
  observacaoLacreRic,
  parseServicoEfeito,
  patioContaComoArmazenada,
  statusParaHandling,
  validarCamposEfeito,
  linhaObservacaoTrocaLacre,
  linhaObservacaoTransbordo,
  appendObservacao,
  composeObservacao,
  separarObservacaoLivreEEfeitos,
} from './servico-efeito';

describe('servico-efeito', () => {
  it('efeito desconhecido vira NENHUM', () => {
    expect(parseServicoEfeito('script-livre')).toBe('NENHUM');
    expect(parseServicoEfeito('TRANSBORDO_CARGA')).toBe('TRANSBORDO_CARGA');
  });

  it('handling após troca de status usa sempre CHEIO', () => {
    expect(statusParaHandling(StatusContainerTarifa.VAZIO, true)).toBe(StatusContainerTarifa.CHEIO);
    expect(statusParaHandling(StatusContainerTarifa.VAZIO, false)).toBe(StatusContainerTarifa.VAZIO);
  });

  it('retirada de excesso exige lacre e origem', () => {
    expect(validarCamposEfeito('SUBSTITUIR_LACRE_SAIDA', {}, {}).ok).toBe(false);
    expect(
      validarCamposEfeito('SUBSTITUIR_LACRE_SAIDA', { lacre: 'ABC123', origemLacre: 'CLIENTE' }, {}).ok,
    ).toBe(true);
    expect(
      validarCamposEfeito('SUBSTITUIR_LACRE_SAIDA', { lacre: 'ABC123', origemLacre: 'TERMINAL' }, {}).ok,
    ).toBe(false);
    expect(
      validarCamposEfeito(
        'SUBSTITUIR_LACRE_SAIDA',
        { lacre: 'ABC123', origemLacre: 'TERMINAL' },
        { servicoLacreTerminalCodigo: 'LACRE_RL' },
      ).ok,
    ).toBe(true);
  });

  it('transbordo exige ISO do destino', () => {
    expect(validarCamposEfeito('TRANSBORDO_CARGA', {}, {}).ok).toBe(false);
    expect(validarCamposEfeito('TRANSBORDO_CARGA', { isoDestino: 'GLDU9443335' }, {}).ok).toBe(true);
  });

  it('transbordo só vale para unidade que já está no pátio', () => {
    expect(patioContaComoArmazenada(PatioStatus.ESTOCADO)).toBe(true);
    expect(patioContaComoArmazenada(PatioStatus.SEPARADO)).toBe(true);
    expect(patioContaComoArmazenada(null)).toBe(false);
  });

  it('observação da RIC de saída usa o nome do serviço', () => {
    expect(observacaoLacreRic('Retirada de excesso', {})).toBe(
      'Número do lacre alterado por Retirada de excesso.',
    );
  });

  it('observação de troca de lacre registra serviço e antes/depois', () => {
    expect(
      linhaObservacaoTrocaLacre({
        servico: 'RETIRADA DE EXCESSO',
        anterior: 'CR0381735',
        atual: 'LACREQA01',
        origem: 'CLIENTE',
      }),
    ).toBe('RETIRADA DE EXCESSO: lacre CR0381735 → LACREQA01 (origem cliente).');
  });

  it('observação de transbordo registra origem, destino e status', () => {
    expect(
      linhaObservacaoTransbordo({
        servico: 'Transbordo',
        isoOrigem: 'AAAA1111111',
        isoDestino: 'BBBB2222222',
        papel: 'ORIGEM',
        statusAntes: 'CHEIO',
        statusDepois: 'VAZIO',
      }),
    ).toBe('Transbordo: transbordo de AAAA1111111 (CHEIO → VAZIO) para BBBB2222222.');
    expect(
      linhaObservacaoTransbordo({
        servico: 'Transbordo',
        isoOrigem: 'AAAA1111111',
        isoDestino: 'BBBB2222222',
        papel: 'DESTINO',
        statusAntes: 'VAZIO',
        statusDepois: 'CHEIO',
        lacre: 'XYZ',
      }),
    ).toBe('Transbordo: transbordo de AAAA1111111 para BBBB2222222 (VAZIO → CHEIO); lacre XYZ.');
  });

  it('appendObservacao acumula linhas sem duplicar', () => {
    const linha = 'RETIRADA DE EXCESSO: lacre CR0381735 → LACREQA01 (origem cliente).';
    expect(appendObservacao('', linha)).toBe(linha);
    expect(appendObservacao(linha, linha)).toBe(linha);
    expect(appendObservacao('OCR ok', linha)).toBe(`OCR ok · ${linha}`);
  });

  it('composeObservacao não apaga o texto livre', () => {
    expect(
      composeObservacao('Conferido na portaria.', [
        'RETIRADA DE EXCESSO: lacre CR0381735 → LACREQA01 (origem cliente).',
      ]),
    ).toBe(
      'Conferido na portaria. · RETIRADA DE EXCESSO: lacre CR0381735 → LACREQA01 (origem cliente).',
    );
  });

  it('separarObservacaoLivreEEfeitos não mistura o texto livre com a linha de serviço', () => {
    const linha = 'RETIRADA DE EXCESSO: lacre CR0381735 → LACREQA01 (origem cliente).';
    expect(separarObservacaoLivreEEfeitos(`Conferido na portaria. · ${linha}`, [])).toEqual({
      livre: 'Conferido na portaria.',
      efeitos: [linha],
    });
    expect(separarObservacaoLivreEEfeitos(linha, [])).toEqual({ livre: '', efeitos: [linha] });
    expect(separarObservacaoLivreEEfeitos('OCR ok', [linha])).toEqual({
      livre: 'OCR ok',
      efeitos: [linha],
    });
  });
});
