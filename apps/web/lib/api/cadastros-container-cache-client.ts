import { staffJson } from "@/lib/api/staff-client";
import { isValidISO6346, stripContainerISO } from "@/lib/cadastros/formatters";

export type ContainerCacheRecord = {
  id: string;
  numeroISO: string;
  numeroFormatado?: string;
  tipo: string | null;
  tamanho: string | null;
  primeiraPassagem: string;
};

export type ContainerPassagemEntrada = {
  dataHora: string;
  situacao: string;
  motorista: string;
  placa: string;
  empresa: string;
};

export type ContainerPassagemSaida = {
  dataHora: string;
  situacao: string;
  motorista: string;
  placa: string;
};

export type ContainerPassagem = {
  processoId: string;
  solicitacaoId: string;
  tipoOperacao: string;
  dataProcesso: string;
  entrada: ContainerPassagemEntrada;
  saida: ContainerPassagemSaida | null;
};

export type ContainerHistoricoResponse = {
  numeroISO: string;
  numeroFormatado?: string;
  tipo: string | null;
  tamanho: string | null;
  primeiraPassagem: string;
  historico: ContainerPassagem[];
};

export async function getContainerCache(numeroISO: string): Promise<ContainerCacheRecord> {
  const clean = stripContainerISO(numeroISO);
  return staffJson(`/v2/cadastros/container-cache/${clean}`);
}

export async function createContainerCache(payload: {
  numeroISO: string;
  tipo?: string | null;
  tamanho?: string | null;
}): Promise<ContainerCacheRecord> {
  const clean = stripContainerISO(payload.numeroISO);
  return staffJson("/v2/cadastros/container-cache", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      numeroISO: clean,
      tipo: payload.tipo ?? null,
      tamanho: payload.tamanho ?? null,
    }),
  });
}

export async function fetchContainerHistorico(
  numeroISO: string,
): Promise<ContainerHistoricoResponse> {
  const clean = stripContainerISO(numeroISO);
  return staffJson(`/v2/cadastros/container-cache/${clean}/historico`);
}

/**
 * Verifica cache; cria automaticamente se ISO válido e ainda não existir.
 * Falha silenciosa — não bloqueia operação do Gate.
 */
export async function ensureContainerCache(
  numeroISO: string,
  tipo?: string,
  tamanho?: string,
): Promise<ContainerCacheRecord | null> {
  const clean = stripContainerISO(numeroISO);
  if (!isValidISO6346(clean)) return null;

  try {
    return await getContainerCache(clean);
  } catch {
    try {
      return await createContainerCache({ numeroISO: clean, tipo, tamanho });
    } catch {
      return null;
    }
  }
}
