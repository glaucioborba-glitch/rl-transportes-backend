export type CatalogoMotoristaExterno = {
  id: string;
  cpf: string;
  nome: string;
  origem: string;
  suspenso: boolean;
  suspensoAte: string | null;
  suspensaoDias: number | null;
  suspensaoMotivo: string | null;
  atualizadoEm: string;
};

export function motoristaSuspensoMensagem(hit: CatalogoMotoristaExterno): string {
  const ate = hit.suspensoAte
    ? new Date(hit.suspensoAte).toLocaleDateString("pt-BR")
    : "—";
  const motivo = hit.suspensaoMotivo ? ` Motivo: ${hit.suspensaoMotivo}` : "";
  return `Motorista suspenso neste terminal até ${ate}.${motivo}`;
}
