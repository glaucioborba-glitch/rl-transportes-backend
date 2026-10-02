/**
 * Utilitários de resiliência HTTP para a Intranet (staff).
 * Requisições autenticadas: use `staffRequest` / `staffJson` em `staff-client.ts`
 * (cookies HttpOnly `rl_at` + `credentials: include`).
 */
export {
  ApiError,
  getApiBase,
  toCorporateAuthFailure,
} from "@/lib/api/corporate-auth-client";
export {
  API_ERROR_BAD_GATEWAY,
  API_ERROR_CONNECTION,
  API_ERROR_UNAUTHORIZED,
  pingApiHealth,
  useApiHealth,
} from "@/hooks/use-api-health";
export { staffRequest, staffJson, handleStaffUnauthorized } from "@/lib/api/staff-client";
