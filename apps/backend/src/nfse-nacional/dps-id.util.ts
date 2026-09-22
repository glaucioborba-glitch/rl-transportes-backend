export type DpsIdInput = {
  municipioIbge: string;
  /** CPF (11) ou CNPJ (14) do prestador. */
  documentoPrestador: string;
  serie: string;
  numero: number | string;
};

function apenasDigitos(v: unknown): string {
  return String(v ?? '').replace(/\D/g, '');
}

/**
 * Id da DPS: "DPS" + IBGE(7) + tipo de inscrição(1) + inscrição(14) + série(5) + número(15).
 * CPF é completado com zeros à esquerda. Serve de âncora da assinatura e da consulta GET /dps/{id}.
 */
export function montarDpsId(input: DpsIdInput): string {
  const ibge = apenasDigitos(input.municipioIbge).padStart(7, '0').slice(-7);
  const doc = apenasDigitos(input.documentoPrestador);
  if (doc.length !== 11 && doc.length !== 14) {
    throw new Error('CNPJ/CPF do prestador inválido para montar o Id da DPS.');
  }
  const tipoInscricao = doc.length === 14 ? '2' : '1';
  const inscricao = doc.padStart(14, '0');
  const serie = apenasDigitos(input.serie).padStart(5, '0').slice(-5);
  const numero = apenasDigitos(input.numero).padStart(15, '0').slice(-15);
  return `DPS${ibge}${tipoInscricao}${inscricao}${serie}${numero}`;
}

/** Chave de acesso da NFS-e tem 50 dígitos. */
export function chaveAcessoValida(chave: unknown): boolean {
  return /^\d{50}$/.test(apenasDigitos(chave));
}
