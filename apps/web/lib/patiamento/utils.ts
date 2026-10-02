import type { ContainerPilha, Pilha } from "./types";

/** Ordena da base (1) ao topo (N). */
export function sortContainersByPosicao(containers: ContainerPilha[]): ContainerPilha[] {
  return [...containers].sort((a, b) => a.posicaoNaPilha - b.posicaoNaPilha);
}

export function isTopoDaPilha(container: ContainerPilha, pilha: Pilha): boolean {
  const sorted = sortContainersByPosicao(pilha.containers);
  const top = sorted[sorted.length - 1];
  return top?.id === container.id;
}

export function exigeRemocao(container: ContainerPilha, pilha: Pilha): boolean {
  return !isTopoDaPilha(container, pilha);
}
