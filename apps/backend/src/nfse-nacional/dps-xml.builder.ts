import { montarDpsId } from './dps-id.util';

export type DpsPrestador = {
  cnpj: string;
  inscricaoMunicipal?: string;
  municipioIbge: string;
  /** 1 = Simples Nacional (microempresário), 2 = SN (ME/EPP), 3 = fora do Simples. */
  optanteSimplesNacional: 1 | 2 | 3;
  regimeEspecialTributacao: number;
};

export type DpsTomador = {
  /** CNPJ (14) ou CPF (11); vazio = tomador não identificado. */
  documento?: string;
  nome: string;
  email?: string;
  telefone?: string;
  municipioIbge?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  uf?: string;
};

export type DpsServico = {
  municipioPrestacaoIbge: string;
  /** Código de tributação nacional do serviço (cTribNac). */
  codigoTributacaoNacional: string;
  descricao: string;
  valor: number;
  aliquotaIssPercent: number;
  /** 1 = operação tributável. */
  tributacaoIssqn?: number;
};

export type DpsInput = {
  tpAmb: 1 | 2;
  serie: string;
  numero: number | string;
  emitidaEm: Date;
  competencia?: Date;
  versaoAplicativo: string;
  prestador: DpsPrestador;
  tomador: DpsTomador;
  servico: DpsServico;
  informacoesComplementares?: string;
};

function escapar(valor: unknown): string {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function digitos(v: unknown): string {
  return String(v ?? '').replace(/\D/g, '');
}

function valor2(n: number): string {
  return (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);
}

/** A DPS trabalha com horário de Brasília (UTC-3). */
export function dataHoraBrasilia(d: Date): string {
  const local = new Date(d.getTime() - 3 * 3_600_000);
  return `${local.toISOString().slice(0, 19)}-03:00`;
}

export function dataCompetencia(d: Date): string {
  return new Date(d.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
}

function blocoTomador(t: DpsTomador): string {
  const doc = digitos(t.documento);
  const partes: string[] = [];
  if (doc.length === 14) partes.push(`<CNPJ>${doc}</CNPJ>`);
  else if (doc.length === 11) partes.push(`<CPF>${doc}</CPF>`);
  partes.push(`<xNome>${escapar(t.nome).slice(0, 300)}</xNome>`);

  const endereco: string[] = [];
  if (t.municipioIbge) {
    endereco.push(`<endNac><cMun>${digitos(t.municipioIbge)}</cMun><CEP>${digitos(t.cep)}</CEP></endNac>`);
  }
  if (t.logradouro) endereco.push(`<xLgr>${escapar(t.logradouro).slice(0, 255)}</xLgr>`);
  if (t.numero) endereco.push(`<nro>${escapar(t.numero).slice(0, 60)}</nro>`);
  if (t.complemento) endereco.push(`<xCpl>${escapar(t.complemento).slice(0, 156)}</xCpl>`);
  if (t.bairro) endereco.push(`<xBairro>${escapar(t.bairro).slice(0, 60)}</xBairro>`);
  if (endereco.length) partes.push(`<end>${endereco.join('')}</end>`);

  const fone = digitos(t.telefone);
  if (fone) partes.push(`<fone>${fone.slice(0, 15)}</fone>`);
  if (t.email) partes.push(`<email>${escapar(t.email).slice(0, 80)}</email>`);
  return `<toma>${partes.join('')}</toma>`;
}

/**
 * Monta o XML da DPS (leiaute nacional, namespace SPED) pronto para assinar.
 * Sem quebras de linha: a assinatura enveloped é calculada sobre este texto.
 */
export function construirDpsXml(input: DpsInput): { xml: string; id: string } {
  const id = montarDpsId({
    municipioIbge: input.prestador.municipioIbge,
    documentoPrestador: input.prestador.cnpj,
    serie: input.serie,
    numero: input.numero,
  });

  const prest = [
    `<CNPJ>${digitos(input.prestador.cnpj)}</CNPJ>`,
    input.prestador.inscricaoMunicipal
      ? `<IM>${escapar(input.prestador.inscricaoMunicipal).slice(0, 15)}</IM>`
      : '',
    `<regTrib><opSimpNac>${input.prestador.optanteSimplesNacional}</opSimpNac>` +
      `<regEspTrib>${input.prestador.regimeEspecialTributacao}</regEspTrib></regTrib>`,
  ].join('');

  const serv =
    `<locPrest><cLocPrestacao>${digitos(input.servico.municipioPrestacaoIbge)}</cLocPrestacao></locPrest>` +
    `<cServ><cTribNac>${digitos(input.servico.codigoTributacaoNacional)}</cTribNac>` +
    `<xDescServ>${escapar(input.servico.descricao).slice(0, 2000)}</xDescServ></cServ>`;

  const valores =
    `<vServPrest><vServ>${valor2(input.servico.valor)}</vServ></vServPrest>` +
    `<trib><tribMun><tribISSQN>${input.servico.tributacaoIssqn ?? 1}</tribISSQN>` +
    `<pAliq>${valor2(input.servico.aliquotaIssPercent)}</pAliq></tribMun>` +
    `<totTrib><indTotTrib>0</indTotTrib></totTrib></trib>`;

  const infDPS =
    `<infDPS Id="${id}">` +
    `<tpAmb>${input.tpAmb}</tpAmb>` +
    `<dhEmi>${dataHoraBrasilia(input.emitidaEm)}</dhEmi>` +
    `<verAplic>${escapar(input.versaoAplicativo).slice(0, 20)}</verAplic>` +
    `<serie>${digitos(input.serie).padStart(5, '0').slice(-5)}</serie>` +
    `<nDPS>${digitos(input.numero)}</nDPS>` +
    `<dCompet>${dataCompetencia(input.competencia ?? input.emitidaEm)}</dCompet>` +
    `<tpEmit>1</tpEmit>` +
    `<cLocEmi>${digitos(input.prestador.municipioIbge)}</cLocEmi>` +
    `<prest>${prest}</prest>` +
    blocoTomador(input.tomador) +
    `<serv>${serv}</serv>` +
    `<valores>${valores}</valores>` +
    (input.informacoesComplementares
      ? `<infCompl><xInfComp>${escapar(input.informacoesComplementares).slice(0, 2000)}</xInfComp></infCompl>`
      : '') +
    `</infDPS>`;

  return {
    id,
    xml:
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<DPS xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.00">${infDPS}</DPS>`,
  };
}

/** Evento de cancelamento (e101101) da NFS-e nacional, pronto para assinar. */
export function construirEventoCancelamentoXml(input: {
  tpAmb: 1 | 2;
  chaveAcesso: string;
  cnpjAutor: string;
  /** 1 = erro na emissão, 2 = serviço não prestado, 3 = duplicidade, 4 = outros. */
  codigoMotivo: 1 | 2 | 3 | 4;
  motivo: string;
  ocorridoEm: Date;
  versaoAplicativo: string;
  sequencia?: number;
}): { xml: string; id: string } {
  const chave = digitos(input.chaveAcesso);
  const seq = Math.max(1, Math.round(input.sequencia ?? 1));
  const id = `EVT${chave}101101${String(seq).padStart(3, '0')}`;
  const infEvento =
    `<infEvento Id="${id}">` +
    `<tpAmb>${input.tpAmb}</tpAmb>` +
    `<verAplic>${escapar(input.versaoAplicativo).slice(0, 20)}</verAplic>` +
    `<dhEvento>${dataHoraBrasilia(input.ocorridoEm)}</dhEvento>` +
    `<CNPJAutor>${digitos(input.cnpjAutor)}</CNPJAutor>` +
    `<chNFSe>${chave}</chNFSe>` +
    `<nPedRegEvento>${seq}</nPedRegEvento>` +
    `<e101101><xDesc>Cancelamento de NFS-e</xDesc>` +
    `<cMotivo>${input.codigoMotivo}</cMotivo>` +
    `<xMotivo>${escapar(input.motivo).slice(0, 255)}</xMotivo></e101101>` +
    `</infEvento>`;
  return {
    id,
    xml:
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<pedRegEvento xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.00">${infEvento}</pedRegEvento>`,
  };
}
