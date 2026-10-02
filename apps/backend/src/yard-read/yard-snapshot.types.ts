export type YardContainerSnapshot = {
  id: string;
  numero: string;
  tipo: 'DRY' | 'REEFER' | 'TANK';
  clienteFinal: string;
  posicaoNaPilha: number;
};

export type YardPilhaSnapshot = {
  id: string;
  codigo: string;
  containers: YardContainerSnapshot[];
};

export type YardSnapshotResponse = {
  pilhas: YardPilhaSnapshot[];
  atualizadoEm: string;
};

export function yardSnapshotRedisKey(clienteId: string): string {
  return `yard:snapshot:${clienteId}`;
}
