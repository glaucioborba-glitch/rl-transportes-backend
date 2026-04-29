import { staffJson, staffTryJson } from "@/lib/api/staff-client";
import { hashSeed, pick } from "@/lib/rh/hash";
import {
  inferStatus,
  inferTurno,
  mockNrPack,
  mockPermissionsForRole,
  summarizeNrCompliance,
} from "@/lib/rh/nr-skills-mock";
import type { RhColaboradorDirectoryItem } from "@/lib/rh/types";

type FolhaColaborador = {
  id: string;
  nome: string;
  cpf: string;
  cargo: string;
  turno: string;
  dataAdmissao: string;
  dataDemissao?: string;
};

type DashboardOperador = {
  usuarioId: string;
  email?: string | null;
  operacoes24h: number;
};

type DashboardRes = {
  filas: { operacoesAtivasPorOperador: DashboardOperador[] };
};

type MaybeUsersResponse = unknown;

const OPS_ROLES = ["OPERADOR_PORTARIA", "OPERADOR_GATE", "OPERADOR_PATIO", "GERENTE", "ADMIN"] as const;

function normalizeKey(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9.]/g, "");
}

function nomeFromEmail(email: string): string {
  const local = email.split("@")[0] ?? email;
  return local
    .split(/[._-]/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

function parseUsersPayload(raw: MaybeUsersResponse): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw as Record<string, unknown>[];
  if (raw && typeof raw === "object" && "items" in raw && Array.isArray((raw as { items: unknown }).items)) {
    return (raw as { items: Record<string, unknown>[] }).items;
  }
  return [];
}

function str(rec: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = rec[k];
    if (typeof v === "string" && v) return v;
  }
  return null;
}

function pickOperadorRole(seed: number): string {
  return pick(seed, [...OPS_ROLES]);
}

export async function fetchRhDirectoryMerged(): Promise<RhColaboradorDirectoryItem[]> {
  const today = new Date().toISOString().slice(0, 10);
  const ini = new Date();
  ini.setDate(ini.getDate() - 30);

  const [apiUsersRaw, folhaList, dash] = await Promise.all([
    staffTryJson<MaybeUsersResponse>("/users"),
    staffTryJson<FolhaColaborador[]>("/folha/colaboradores").catch(() => [] as FolhaColaborador[]),
    staffJson<DashboardRes>(
      `/dashboard?dataInicio=${ini.toISOString().slice(0, 10)}&dataFim=${today}`,
    ).catch(() => ({ filas: { operacoesAtivasPorOperador: [] } })),
  ]);

  const apiUsers = parseUsersPayload(apiUsersRaw);
  const folha = Array.isArray(folhaList) ? folhaList : [];
  const ops = dash?.filas?.operacoesAtivasPorOperador ?? [];

  const byId = new Map<string, RhColaboradorDirectoryItem>();

  function mergeFolha(
    id: string,
    nomeGuess: string,
    email: string | null,
  ): Partial<RhColaboradorDirectoryItem> {
    const nk = normalizeKey(nomeGuess);
    const f = folha.find((c) => {
      const cn = normalizeKey(c.nome);
      return cn === nk || (email && cn === normalizeKey(email.split("@")[0] ?? ""));
    });
    if (!f) return {};
    const nr = mockNrPack(id);
    return {
      cpf: f.cpf,
      cargo: f.cargo,
      dataAdmissao: f.dataAdmissao,
      status: inferStatus(f.dataDemissao, id),
      turno: inferTurno(id, f.turno),
      complianceNrLabel: summarizeNrCompliance(nr),
    };
  }

  for (const u of apiUsers) {
    const id = str(u, "id", "_id") ?? "";
    if (!id) continue;
    const email = str(u, "email");
    const role = str(u, "role") ?? "OPERADOR_GATE";
    const perms = u.permissions;
    const permissions = Array.isArray(perms) ? perms.map(String) : mockPermissionsForRole(role);
    const nome = str(u, "nome", "name") ?? (email ? nomeFromEmail(email) : `Usuário ${id.slice(0, 8)}`);
    const opM = ops.find((o) => o.usuarioId === id);
    const partial = mergeFolha(id, nome, email);
    const nr = mockNrPack(id, { admin: role === "ADMIN" || role === "GERENTE" });
    byId.set(id, {
      id,
      source: "api_user",
      nome,
      email,
      role,
      permissions,
      status: partial.status ?? inferStatus(undefined, id),
      turno: partial.turno ?? inferTurno(id),
      ultimoAcesso: null,
      operacoes24h: opM?.operacoes24h ?? null,
      cpf: partial.cpf ?? null,
      cargo: partial.cargo ?? null,
      dataAdmissao: partial.dataAdmissao ?? null,
      aptidaoLabel:
        role === "ADMIN" || role === "GERENTE"
          ? "Staff / Supervisão"
          : pick(hashSeed(id), ["Multifunção", "Gate-first", "Pátio prioritário", "Portaria"]),
      complianceNrLabel: partial.complianceNrLabel ?? summarizeNrCompliance(nr),
    });
  }

  for (const o of ops) {
    if (byId.has(o.usuarioId)) continue;
    const email = o.email ?? null;
    const nome = email ? nomeFromEmail(email) : `Operador ${o.usuarioId.slice(0, 8)}`;
    const role = pickOperadorRole(hashSeed(o.usuarioId));
    const partial = mergeFolha(o.usuarioId, nome, email);
    const nr = mockNrPack(o.usuarioId);
    byId.set(o.usuarioId, {
      id: o.usuarioId,
      source: "dashboard_only",
      nome,
      email,
      role,
      permissions: mockPermissionsForRole(role),
      status: partial.status ?? inferStatus(undefined, o.usuarioId),
      turno: partial.turno ?? inferTurno(o.usuarioId),
      ultimoAcesso: null,
      operacoes24h: o.operacoes24h,
      cpf: partial.cpf ?? null,
      cargo: partial.cargo ?? null,
      dataAdmissao: partial.dataAdmissao ?? null,
      aptidaoLabel: pick(hashSeed(o.usuarioId), ["Multifunção", "Gate-first", "Pátio prioritário"]),
      complianceNrLabel: partial.complianceNrLabel ?? summarizeNrCompliance(nr),
    });
  }

  for (const f of folha) {
    const existingCpfs = new Set(Array.from(byId.values()).map((r) => r.cpf).filter(Boolean));
    if (f.cpf && existingCpfs.has(f.cpf)) continue;
    const id = `folha-${f.id}`;
    if (byId.has(id)) continue;
    const role = pickOperadorRole(hashSeed(id));
    const nr = mockNrPack(id);
    byId.set(id, {
      id,
      source: "folha_only",
      nome: f.nome,
      email: null,
      role,
      permissions: mockPermissionsForRole(role),
      status: inferStatus(f.dataDemissao, id),
      turno: inferTurno(id, f.turno),
      ultimoAcesso: null,
      operacoes24h: null,
      cpf: f.cpf,
      cargo: f.cargo,
      dataAdmissao: f.dataAdmissao,
      aptidaoLabel: "Cadastro folha (sem vínculo SSO)",
      complianceNrLabel: summarizeNrCompliance(nr),
    });
  }

  return Array.from(byId.values()).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export async function fetchRhColaboradorById(id: string): Promise<RhColaboradorDirectoryItem | null> {
  const tryApi = await staffTryJson<Record<string, unknown>>(`/users/${id}`);
  const list = await fetchRhDirectoryMerged();
  const fromList = list.find((r) => r.id === id) ?? null;

  if (tryApi && typeof tryApi === "object" && str(tryApi, "id")) {
    const merged = fromList;
    const email = str(tryApi, "email");
    const role = str(tryApi, "role") ?? merged?.role ?? "OPERADOR_GATE";
    const nome =
      str(tryApi, "nome", "name") ??
      merged?.nome ??
      (email ? nomeFromEmail(email) : `Usuário ${id.slice(0, 8)}`);
    const perms = tryApi.permissions;
    const permissions = Array.isArray(perms) ? perms.map(String) : mockPermissionsForRole(role);
    const nr = mockNrPack(id, { admin: role === "ADMIN" || role === "GERENTE" });
    return {
      id: str(tryApi, "id")!,
      source: "api_user",
      nome,
      email,
      role,
      permissions,
      status: merged?.status ?? inferStatus(undefined, id),
      turno: merged?.turno ?? inferTurno(id),
      ultimoAcesso: null,
      operacoes24h: merged?.operacoes24h ?? null,
      cpf: merged?.cpf ?? null,
      cargo: merged?.cargo ?? null,
      dataAdmissao: merged?.dataAdmissao ?? null,
      aptidaoLabel: merged?.aptidaoLabel ?? "—",
      complianceNrLabel: merged?.complianceNrLabel ?? summarizeNrCompliance(nr),
    };
  }

  return fromList;
}
