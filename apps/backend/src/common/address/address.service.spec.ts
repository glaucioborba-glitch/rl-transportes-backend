import { Test } from '@nestjs/testing';
import { AddressInvalidException } from './exceptions/address-invalid.exception';
import { IbgeService } from './ibge.service';
import { CepCacheService } from '../../cep-cache/cep-cache.service';
import { AddressService } from './address.service';

describe('AddressService', () => {
  let service: AddressService;
  let cepCache: { getCep: jest.Mock };
  let ibge: { assertIbgeValid: jest.Mock; getMunicipios: jest.Mock };

  beforeEach(async () => {
    cepCache = { getCep: jest.fn() };
    ibge = {
      assertIbgeValid: jest.fn().mockResolvedValue({ codigoIbge: '4205407' }),
      getMunicipios: jest.fn().mockResolvedValue([
        { codigoIbge: '4205407', nome: 'Florianópolis', uf: 'SC' },
      ]),
    };

    const mod = await Test.createTestingModule({
      providers: [
        AddressService,
        { provide: CepCacheService, useValue: cepCache },
        { provide: IbgeService, useValue: ibge },
      ],
    }).compile();

    service = mod.get(AddressService);
  });

  describe('lookupCepAutofill', () => {
    it('CEP válido retorna IBGE via cache', async () => {
      cepCache.getCep.mockResolvedValue({
        cepValido: true,
        cep: '88010000',
        logradouro: 'Rua Teste',
        bairro: 'Centro',
        cidade: 'Florianópolis',
        uf: 'SC',
        ibge: '4205407',
      });

      const r = await service.lookupCepAutofill('88010000');
      expect(r.cepValido).toBe(true);
      expect(r.ibge).toBe('4205407');
    });

    it('CEP inexistente não gera exceção — retorna cepValido false', async () => {
      cepCache.getCep.mockResolvedValue({
        cepValido: false,
        cep: '99999999',
        logradouro: null,
        bairro: null,
        cidade: null,
        uf: null,
        ibge: null,
      });

      const r = await service.lookupCepAutofill('99999999');
      expect(r.cepValido).toBe(false);
      expect(r.ibge).toBeNull();
    });

    it('formato inválido continua bloqueando', async () => {
      cepCache.getCep.mockRejectedValue(new AddressInvalidException('CEP deve ter 8 dígitos.'));
      await expect(service.lookupCepAutofill('123')).rejects.toBeInstanceOf(AddressInvalidException);
    });
  });

  describe('normalize', () => {
    it('cadastro continua quando CEP não retorna dados e usuário informa endereço manual', async () => {
      cepCache.getCep.mockResolvedValue({
        cepValido: false,
        cep: '88010000',
        logradouro: null,
        bairro: null,
        cidade: null,
        uf: null,
        ibge: null,
      });

      const r = await service.normalize({
        cep: '88010000',
        logradouro: 'Rua Manual',
        numero: '100',
        bairro: 'Centro',
        cidade: 'Florianópolis',
        uf: 'SC',
      });

      expect(r.codigoIbge).toBe('4205407');
      expect(r.logradouro).toBe('Rua Manual');
    });

    it('cadastro continua com CEP parcial (sem bairro) quando usuário preenche', async () => {
      cepCache.getCep.mockResolvedValue({
        cepValido: true,
        cep: '88010000',
        logradouro: '',
        bairro: null,
        cidade: 'Florianópolis',
        uf: 'SC',
        ibge: '4205407',
      });

      const r = await service.normalize({
        cep: '88010000',
        logradouro: 'Rua Informada',
        numero: '50',
        bairro: 'Trindade',
        cidade: 'Florianópolis',
        uf: 'SC',
      });

      expect(r.bairro).toBe('Trindade');
      expect(r.codigoIbge).toBe('4205407');
    });

    it('cadastro continua com IBGE informado quando API do IBGE está offline', async () => {
      cepCache.getCep.mockResolvedValue({
        cepValido: false,
        cep: '88375000',
        logradouro: null,
        bairro: null,
        cidade: null,
        uf: null,
        ibge: null,
      });
      ibge.assertIbgeValid.mockResolvedValue(null);
      ibge.getMunicipios.mockResolvedValue([]);

      const r = await service.normalize({
        cep: '88375000',
        logradouro: 'Rua Teste',
        numero: '123',
        bairro: 'Centro',
        cidade: 'Navegantes',
        uf: 'SC',
        codigoIbge: '4211306',
      });

      expect(r.codigoIbge).toBe('4211306');
      expect(r.cidade).toBe('Navegantes');
    });
  });
});
