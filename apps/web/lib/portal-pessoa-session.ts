import { ApiError } from "@/lib/api/corporate-auth-client";
import type { AuthLoginResponse, PortalLoginResponse } from "@/lib/api/types";
import type { PermissoesPessoa } from "@/stores/pessoaPermissoesStore";
import { hasPortalClientSession } from "@/lib/portal-auth-mode";
import { usePortalClienteAuthStore, type PortalUser } from "@/stores/portalClienteAuthStore";

export type PessoaAutorizadaRow = {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
};

export type EnsurePortalPessoaResult =
  | { status: "ok"; pessoa: PessoaAutorizadaRow }
  | { status: "need-select" }
  | { status: "error"; message: string };

export function inferPortalClienteTipo(
  user: { tipo?: "PF" | "PJ"; cpfCnpj?: string } | null | undefined,
): "PF" | "PJ" | null {
  if (user?.tipo === "PF" || user?.tipo === "PJ") return user.tipo;
  const d = user?.cpfCnpj?.replace(/\D/g, "") ?? "";
  if (d.length === 11) return "PF";
  if (d.length === 14) return "PJ";
  return null;
}

export function mapPortalLoginToUser(r: PortalLoginResponse): AuthLoginResponse["user"] {
  const pi = r.portalIdentity;
  const tipo = r.usuario?.tipo ?? r.tipo ?? inferPortalClienteTipo({ cpfCnpj: pi.cpfCnpj });
  return {
    id: pi.sub,
    cpfCnpj: pi.cpfCnpj,
    email: pi.email,
    role: pi.portalPapel,
    permissions: [],
    clienteId: r.clienteId ?? null,
    ...(tipo ? { tipo } : {}),
    ...(r.usuario?.nome ? { nome: r.usuario.nome } : {}),
  };
}

export function mergePortalUserAfterRefresh(
  prev: PortalUser | null,
  refresh: PortalLoginResponse,
): PortalUser {
  const pi = refresh.portalIdentity;
  const tipo =
    refresh.usuario?.tipo ??
    refresh.tipo ??
    prev?.tipo ??
    inferPortalClienteTipo({ cpfCnpj: pi?.cpfCnpj ?? prev?.cpfCnpj });
  const base: PortalUser = prev ?? {
    id: pi.sub,
    cpfCnpj: pi.cpfCnpj,
    email: pi.email,
    role: pi.portalPapel,
    permissions: [],
    clienteId: refresh.clienteId ?? null,
  };
  return {
    ...base,
    id: pi.sub,
    cpfCnpj: pi.cpfCnpj,
    email: pi.email,
    role: pi.portalPapel,
    clienteId: refresh.clienteId ?? base.clienteId ?? null,
    ...(tipo ? { tipo } : {}),
    ...(refresh.usuario?.nome ? { nome: refresh.usuario.nome } : base.nome ? { nome: base.nome } : {}),
  };
}

/** Persiste tokens, usuário e tenant (cliente) após login ou refresh portal. */
export function applyPortalLoginResponse(raw: PortalLoginResponse): void {
  const st = usePortalClienteAuthStore.getState();
  st.setSession(raw.accessToken, raw.refreshToken, mergePortalUserAfterRefresh(st.user, raw));
  if (raw.cliente !== undefined) {
    st.setCliente(raw.cliente);
  }
}

type ValidarPessoaFn = (cpf: string) => Promise<PessoaAutorizadaRow>;
type FetchPermissoesFn = () => Promise<PermissoesPessoa | null>;
type ClearPermissoesCacheFn = () => void;

/** PF: vincula titular na sessão Redis + stores locais; PJ: indica seleção de CPF. */
export async function ensurePortalPessoaSession(
  deps: {
    portalValidarPessoa: ValidarPessoaFn;
    fetchPermissoes: FetchPermissoesFn;
    clearPortalMinhasPermissoesCache: ClearPermissoesCacheFn;
  },
  opts?: {
    cpfCnpj?: string;
    pessoaFromLogin?: PortalLoginResponse["pessoaAutorizada"] | null;
    force?: boolean;
  },
): Promise<EnsurePortalPessoaResult> {
  const st = usePortalClienteAuthStore.getState();
  if (!hasPortalClientSession(st)) {
    return { status: "error", message: "Sessão não iniciada." };
  }

  const cpfCnpj = opts?.cpfCnpj ?? st.user?.cpfCnpj ?? "";
  const tipo = inferPortalClienteTipo(st.user ?? undefined);
  const digits = cpfCnpj.replace(/\D/g, "");

  const { usePessoaAutorizadaStore } = await import("@/stores/pessoaAutorizadaStore");
  const { usePessoaPermissoesStore } = await import("@/stores/pessoaPermissoesStore");
  const existingId = usePessoaAutorizadaStore.getState().pessoa?.id;

  if (tipo === "PJ" || (tipo === null && digits.length === 14)) {
    return { status: "need-select" };
  }

  if (!opts?.force && existingId && tipo === "PF") {
    return {
      status: "ok",
      pessoa: usePessoaAutorizadaStore.getState().pessoa as PessoaAutorizadaRow,
    };
  }

  if (digits.length !== 11) {
    return {
      status: "error",
      message: "CPF do titular inválido para esta conta.",
    };
  }

  try {
    if (opts?.pessoaFromLogin) {
      usePessoaAutorizadaStore.getState().setPessoa({
        id: opts.pessoaFromLogin.id,
        nome: opts.pessoaFromLogin.nome,
        email: opts.pessoaFromLogin.email,
        telefone: opts.pessoaFromLogin.telefone,
      });
    }

    const saved = await deps.portalValidarPessoa(digits);
    usePessoaAutorizadaStore.getState().setPessoa({
      id: saved.id,
      nome: saved.nome,
      email: saved.email,
      telefone: saved.telefone,
    });

    deps.clearPortalMinhasPermissoesCache();
    const perm = await deps.fetchPermissoes();
    if (perm) {
      usePessoaPermissoesStore.getState().setPermissoes(perm, saved.id);
    }

    return { status: "ok", pessoa: saved };
  } catch (e) {
    const msg =
      e instanceof ApiError && e.status === 401
        ? "CPF não encontrado ou não autorizado. Verifique seu cadastro ou contate o suporte."
        : e instanceof ApiError
          ? e.message
          : "Não foi possível confirmar sua identidade.";
    return { status: "error", message: msg };
  }
}

export async function bootstrapPortalPessoaIdentidade(
  deps: Parameters<typeof ensurePortalPessoaSession>[0],
  opts: {
    cpfCnpj: string;
    pessoaFromLogin?: PortalLoginResponse["pessoaAutorizada"] | null;
  },
): Promise<PessoaAutorizadaRow> {
  const r = await ensurePortalPessoaSession(deps, opts);
  if (r.status === "ok") return r.pessoa;
  if (r.status === "need-select") {
    throw new ApiError("Selecione sua identidade (CPF) para continuar.", 403);
  }
  throw new ApiError(r.message, 401);
}
