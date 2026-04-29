import * as crypto from 'crypto';
import { pipelineOcrGateMock, resolverProviderMock, validarExtracaoOcrGate } from './ia-operacional.ocr-mock';

describe('ia-operacional.ocr-mock', () => {
  it('resolverProviderMock retorna um dos providers conhecidos', () => {
    const b = Buffer.from('gate-scan-test');
    const p = resolverProviderMock(b);
    expect(['GOOGLE_VISION', 'AWS_REKOGNITION', 'OPENCV_STUB']).toContain(p);
  });

  it('validarExtracaoOcrGate marca ISO válido', () => {
    const v = validarExtracaoOcrGate({
      placaRaw: 'ABC1D34',
      numeroIsoRaw: 'TEMU6079348',
      tipoContainerRaw: '40HC',
      fullnessRaw: 'CHEIO',
      lacreRaw: 'L123456',
    });
    expect(v.numeroIsoValido6346).toBe(true);
    expect(v.placaValidaMercosul).toBe(true);
    expect(v.numeroIso).toBe('TEMU6079348');
  });

  it('pipelineOcrGateMock é determinístico para mesmo buffer', () => {
    const buf = crypto.randomBytes(32);
    const a = pipelineOcrGateMock(buf);
    const b = pipelineOcrGateMock(buf);
    expect(a.placa).toEqual(b.placa);
    expect(a.numeroIso).toEqual(b.numeroIso);
  });
});
