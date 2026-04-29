import type { TomadorNfseDto } from '../dto/emitir-nfse.dto';
import { escapeIpmNfseXmlValue } from './ipm-nfse-xml.escape';
import { formatBrReal } from './ipm-nfse-xml.money';
import { sanitizeIpmNfseCancelTag } from './ipm-nfse-cancel-tag.util';

export type RpsIpmInput = {
  nroReciboProvisorio: string;
  serieReciboProvisorio: string;
  dataEmissao: string; // dd/mm/yyyy
  horaEmissao: string; // HH:mm:ss
};

export type ServicoListaIpmInput = {
  codigoLocalPrestacao: string;
  codigoAtividade: string;
  codigoItemListaServico: string;
  descritivo: string;
  /** ex.: 2 -> 2,0000 */
  aliquotaPercent: number;
  situacaoTributaria: string;
  valorTributavel: number;
  valorDeducao?: number;
  valorIssrf?: number;
  valorDescontoIncondicional?: number;
  tributaMunicipioPrestador: 'S' | 'N';
  tributaMunicipioTomador: 'S' | 'N';
};

export type EmissaoNfseIpmPayload = {
  identificadorArquivo?: string;
  /** NTE-35 §4.8: tag de teste (não emite, valida layout). */
  modoTeste?: boolean;
  rps: RpsIpmInput;
  /** Data fato (geralmente mesma do RPS). dd/mm/yyyy */
  dataFato: string;
  /** Valor total = soma do serviço (conferência com faturamento). */
  valorTotal: number;
  /** Observação livre ou "0" como na nota 430. */
  observacao: string;
  prestador: { cnpj: string; cidadeTom: string };
  tomador: TomadorNfseDto;
  servico: ServicoListaIpmInput;
};

function aliquotaBr4(percent: number): string {
  return percent.toFixed(4).replace('.', ',');
}

/**
 * Estrutura alinhada ao export XML da NFS-e 430 (Navegantes) e NTE-35/2021.
 * Encoding ISO-8859-1 conforme padrão IPM.
 */
export function buildEmissaoNfseIpmXml(payload: EmissaoNfseIpmPayload): string {
  const t = payload.tomador;
  const z = (s: string | undefined, d = '') => s ?? d;
  const s = payload.servico;
  const desc = escapeIpmNfseXmlValue(s.descritivo);
  const zeros = '0,00';
  const vt = formatBrReal(s.valorTributavel);
  const vtot = formatBrReal(payload.valorTotal);

  const ident = payload.identificadorArquivo
    ? `<identificador>${escapeIpmNfseXmlValue(payload.identificadorArquivo)}</identificador>\n  `
    : '';
  const teste = payload.modoTeste ? '<teste>1</teste>\n  ' : '';

  return `<?xml version="1.0" encoding="ISO-8859-1"?>
<nfse>
  ${teste}${ident}<rps>
    <nro_recibo_provisorio>${escapeIpmNfseXmlValue(payload.rps.nroReciboProvisorio)}</nro_recibo_provisorio>
    <serie_recibo_provisorio>${escapeIpmNfseXmlValue(payload.rps.serieReciboProvisorio)}</serie_recibo_provisorio>
    <data_emissao_recibo_provisorio>${escapeIpmNfseXmlValue(payload.rps.dataEmissao)}</data_emissao_recibo_provisorio>
    <hora_emissao_recibo_provisorio>${escapeIpmNfseXmlValue(payload.rps.horaEmissao)}</hora_emissao_recibo_provisorio>
  </rps>
  <nf>
    <data_fato>${escapeIpmNfseXmlValue(payload.dataFato)}</data_fato>
    <valor_total>${vtot}</valor_total>
    <valor_desconto>${zeros}</valor_desconto>
    <valor_ir>${zeros}</valor_ir>
    <valor_inss>${zeros}</valor_inss>
    <valor_contribuicao_social>${zeros}</valor_contribuicao_social>
    <valor_rps>${zeros}</valor_rps>
    <valor_pis>${zeros}</valor_pis>
    <valor_cofins>${zeros}</valor_cofins>
    <observacao>${escapeIpmNfseXmlValue(payload.observacao)}</observacao>
  </nf>
  <prestador>
    <cpfcnpj>${escapeIpmNfseXmlValue(payload.prestador.cnpj)}</cpfcnpj>
    <cidade>${escapeIpmNfseXmlValue(payload.prestador.cidadeTom)}</cidade>
  </prestador>
  <tomador>
    <tipo>${escapeIpmNfseXmlValue(t.tipo)}</tipo>
    <cpfcnpj>${escapeIpmNfseXmlValue(t.cpfcnpj)}</cpfcnpj>
    <ie>${escapeIpmNfseXmlValue(z(t.ie, ''))}</ie>
    <sobrenome_nome_fantasia>${escapeIpmNfseXmlValue(t.sobrenomeNomeFantasia)}</sobrenome_nome_fantasia>
    <nome_razao_social>${escapeIpmNfseXmlValue(t.nomeRazaoSocial)}</nome_razao_social>
    <numero_residencia>${escapeIpmNfseXmlValue(t.numeroResidencia)}</numero_residencia>
    <complemento>${escapeIpmNfseXmlValue(z(t.complemento, ''))}</complemento>
    <ponto_referencia>${escapeIpmNfseXmlValue(z(t.pontoReferencia, '0'))}</ponto_referencia>
    <pais>${escapeIpmNfseXmlValue(t.pais)}</pais>
    <siglaPais>${escapeIpmNfseXmlValue(t.siglaPais)}</siglaPais>
    <codigoIbgePais>${escapeIpmNfseXmlValue(t.codigoIbgePais)}</codigoIbgePais>
    <estado>${escapeIpmNfseXmlValue(t.estado)}</estado>
    <cidade>${escapeIpmNfseXmlValue(t.cidadeTom)}</cidade>
    <logradouro>${escapeIpmNfseXmlValue(t.logradouro)}</logradouro>
    <bairro>${escapeIpmNfseXmlValue(t.bairro)}</bairro>
    <cep>${escapeIpmNfseXmlValue(t.cep)}</cep>
    <ddd_fone_residencial>${escapeIpmNfseXmlValue(z(t.dddFoneResidencial, '0'))}</ddd_fone_residencial>
    <ddd_fone_comercial>${escapeIpmNfseXmlValue(z(t.dddFoneComercial, '0'))}</ddd_fone_comercial>
    <fone_residencial>${escapeIpmNfseXmlValue(z(t.foneResidencial, '00000000000'))}</fone_residencial>
    <fone_comercial>${escapeIpmNfseXmlValue(z(t.foneComercial, '0'))}</fone_comercial>
    <ddd_fax>${escapeIpmNfseXmlValue(z(t.dddFax, '0'))}</ddd_fax>
    <fone_fax>${escapeIpmNfseXmlValue(z(t.foneFax, '0'))}</fone_fax>
    <email>${escapeIpmNfseXmlValue(t.email)}</email>
  </tomador>
  <itens>
    <lista>
      <codigo_local_prestacao_servico>${escapeIpmNfseXmlValue(s.codigoLocalPrestacao)}</codigo_local_prestacao_servico>
      <codigo_atividade>${escapeIpmNfseXmlValue(s.codigoAtividade)}</codigo_atividade>
      <codigo_item_lista_servico>${escapeIpmNfseXmlValue(s.codigoItemListaServico)}</codigo_item_lista_servico>
      <descritivo>${desc}</descritivo>
      <aliquota_item_lista_servico>${aliquotaBr4(s.aliquotaPercent)}</aliquota_item_lista_servico>
      <situacao_tributaria>${escapeIpmNfseXmlValue(s.situacaoTributaria)}</situacao_tributaria>
      <valor_tributavel>${vt}</valor_tributavel>
      <valor_deducao>${formatBrReal(s.valorDeducao ?? 0)}</valor_deducao>
      <valor_issrf>${formatBrReal(s.valorIssrf ?? 0)}</valor_issrf>
      <valor_desconto_incondicional>${formatBrReal(s.valorDescontoIncondicional ?? 0)}</valor_desconto_incondicional>
      <tributa_municipio_prestador>${s.tributaMunicipioPrestador}</tributa_municipio_prestador>
      <tributa_municipio_tomador>${s.tributaMunicipioTomador}</tributa_municipio_tomador>
    </lista>
  </itens>
</nfse>`;
}

export function buildCancelamentoNfseIpmXml(input: {
  numeroNfse: string;
  serieNfse: string;
  motivo: string;
  prestador: { cnpj: string; cidadeTom: string };
  /** Nome do elemento (valor fixo C) — NTE-35; ajuste NFSE_IPM_TAG_CANCEL se o portal rejeitar. */
  tagIndicadorCancelamento?: string;
}): string {
  const tag = sanitizeIpmNfseCancelTag(input.tagIndicadorCancelamento);
  return `<?xml version="1.0" encoding="ISO-8859-1"?>
<nfse>
  <nf>
    <numero_nfse>${escapeIpmNfseXmlValue(input.numeroNfse)}</numero_nfse>
    <serie_nfse>${escapeIpmNfseXmlValue(input.serieNfse)}</serie_nfse>
    <${tag}>C</${tag}>
    <motivo_cancelamento>${escapeIpmNfseXmlValue(input.motivo)}</motivo_cancelamento>
  </nf>
  <prestador>
    <cpfcnpj>${escapeIpmNfseXmlValue(input.prestador.cnpj)}</cpfcnpj>
    <cidade>${escapeIpmNfseXmlValue(input.prestador.cidadeTom)}</cidade>
  </prestador>
</nfse>`;
}

export function buildConsultaNfseIpmPorAutenticidade(codigoAutenticidade: string): string {
  const c = escapeIpmNfseXmlValue(codigoAutenticidade.trim());
  return `<?xml version="1.0" encoding="ISO-8859-1"?>
<nfse>
  <pesquisa>
    <codigo_autenticidade>${c}</codigo_autenticidade>
  </pesquisa>
</nfse>`;
}
