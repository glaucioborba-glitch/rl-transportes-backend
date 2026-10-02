import {
  mapClienteToTransportadoraStub,
  mergeDadosTransportadoraFromCliente,
} from './cliente-transportadora-sync.util';

describe('mapClienteToTransportadoraStub', () => {
  it('normaliza CNPJ e telefone e preenche endereço no JSON', () => {
    const stub = mapClienteToTransportadoraStub({
      razaoSocial: ' Atlântico Logística ',
      nomeFantasia: 'Atlântico',
      cpfCnpj: '27.000.245/0004-18',
      inscricaoEstadual: '123',
      email: 'a@x.com',
      telefone: '(47) 3333-0000',
      enderecoCidade: 'Itajaí',
      enderecoUf: 'sc',
      enderecoCep: '88301-000',
      enderecoLogradouro: 'Rua A',
      enderecoNumero: '10',
      enderecoBairro: 'Centro',
    });
    expect(stub.cnpj).toBe('27000245000418');
    expect(stub.telefone).toBe('4733330000');
    expect(stub.uf).toBe('SC');
    expect(stub.dadosFromCliente.cep).toBe('88301000');
    expect(stub.dadosFromCliente.endereco).toBe('Rua A');
  });
});

describe('mergeDadosTransportadoraFromCliente', () => {
  it('não apaga frota/RNTRC já preenchidos na ficha operacional', () => {
    const merged = mergeDadosTransportadoraFromCliente(
      { frotaTotal: 12, endereco: 'Rua velha', cep: '' },
      { frotaTotal: 0, endereco: 'Rua nova', cep: '88301000', bairro: 'Centro' },
    );
    expect(merged.frotaTotal).toBe(12);
    expect(merged.endereco).toBe('Rua velha');
    expect(merged.cep).toBe('88301000');
    expect(merged.bairro).toBe('Centro');
  });
});
