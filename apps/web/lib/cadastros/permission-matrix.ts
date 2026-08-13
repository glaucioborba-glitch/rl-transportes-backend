/**
 * Matriz de permissões do módulo de Cadastros.
 * Cada bloco tem 4 níveis de ação: VIEW, CREATE, EDIT, DELETE (soft-delete).
 * O ADMIN pode delegar qualquer combinação para qualquer usuário.
 */

export type CadastroAction = "VIEW" | "CREATE" | "EDIT" | "DELETE";
export type CadastroBlock = "pessoas" | "operacional" | "financeiro" | "contratos" | "parametros";

export interface BlockPermission {
  block: CadastroBlock;
  actions: CadastroAction[];
}

export interface UserCadastrosPermission {
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  permissions: BlockPermission[];
  delegatedBy: string;
  delegatedAt: string;
  expiresAt?: string;
}

export const CADASTROS_ENABLED_PERMISSION = "cadastros:enabled";

const DELEGATIONS_STORAGE_KEY = "rl_cadastros_delegations";

export const CADASTROS_MODULE_ROLES = ["ADMIN", "GERENTE", "FINANCEIRO", "RH"] as const;

/**
 * Permissões padrão por perfil (sem delegação explícita):
 * - ADMIN: tudo, sempre
 * - GERENTE: view em tudo, edit em pessoas/operacional
 * - FINANCEIRO: view em tudo, edit em financeiro
 * - RH: view em pessoas, edit em pessoas
 * - GATE/PORTEIRO/OUTROS: sem acesso
 */
export const DEFAULT_PERMISSIONS: Record<string, BlockPermission[]> = {
  ADMIN: [
    { block: "pessoas", actions: ["VIEW", "CREATE", "EDIT", "DELETE"] },
    { block: "operacional", actions: ["VIEW", "CREATE", "EDIT", "DELETE"] },
    { block: "financeiro", actions: ["VIEW", "CREATE", "EDIT", "DELETE"] },
    { block: "contratos", actions: ["VIEW", "CREATE", "EDIT", "DELETE"] },
    { block: "parametros", actions: ["VIEW", "CREATE", "EDIT", "DELETE"] },
  ],
  GERENTE: [
    { block: "pessoas", actions: ["VIEW", "CREATE", "EDIT"] },
    { block: "operacional", actions: ["VIEW", "CREATE", "EDIT"] },
    { block: "financeiro", actions: ["VIEW"] },
    { block: "contratos", actions: ["VIEW", "CREATE", "EDIT"] },
    { block: "parametros", actions: ["VIEW", "EDIT"] },
  ],
  FINANCEIRO: [
    { block: "financeiro", actions: ["VIEW", "CREATE", "EDIT"] },
    { block: "contratos", actions: ["VIEW"] },
  ],
  RH: [{ block: "pessoas", actions: ["VIEW", "CREATE", "EDIT"] }],
};

export type CadastrosUserContext = {
  id?: string;
  role: string;
  permissions?: string[];
  cadastrosDelegation?: UserCadastrosPermission | null;
};

function readDelegationsMap(): Record<string, UserCadastrosPermission> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(DELEGATIONS_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, UserCadastrosPermission>;
  } catch {
    return {};
  }
}

export function getStoredCadastrosDelegation(userId: string): UserCadastrosPermission | null {
  const map = readDelegationsMap();
  return map[userId] ?? null;
}

export function saveCadastrosDelegation(delegation: UserCadastrosPermission): void {
  if (typeof window === "undefined") return;
  const map = readDelegationsMap();
  map[delegation.userId] = delegation;
  localStorage.setItem(DELEGATIONS_STORAGE_KEY, JSON.stringify(map));
}

export function listStoredCadastrosDelegations(): UserCadastrosPermission[] {
  return Object.values(readDelegationsMap());
}

export function hasCadastrosModuleAccess(user: CadastrosUserContext): boolean {
  if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") return true;
  if (!CADASTROS_MODULE_ROLES.includes(user.role as (typeof CADASTROS_MODULE_ROLES)[number])) {
    return false;
  }
  if (user.role === "GERENTE") return true;
  if (user.permissions?.includes(CADASTROS_ENABLED_PERMISSION)) return true;
  if (user.id && getStoredCadastrosDelegation(user.id)) return true;
  return false;
}

/**
 * Verifica se um usuário pode executar uma ação em um bloco.
 * Primeiro verifica permissões delegadas; se não houver, usa o padrão do perfil.
 */
export function canDo(user: CadastrosUserContext, block: CadastroBlock, action: CadastroAction): boolean {
  if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") return true;

  const delegation =
    user.cadastrosDelegation ?? (user.id ? getStoredCadastrosDelegation(user.id) : null);

  if (delegation) {
    const delegated = delegation.permissions.find((p) => p.block === block);
    if (delegated) return delegated.actions.includes(action);
  }

  const rolePermissions = DEFAULT_PERMISSIONS[user.role];
  if (!rolePermissions) return false;

  const blockPermission = rolePermissions.find((p) => p.block === block);
  if (!blockPermission) return false;

  return blockPermission.actions.includes(action);
}
