import { PatioStatus, StatusContainerTarifa } from '@prisma/client';
import {
  observacaoLacreRic,
  parseServicoEfeito,
  patioContaComoArmazenada,
  statusParaHandling,
  validarCamposEfeito,
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
});
