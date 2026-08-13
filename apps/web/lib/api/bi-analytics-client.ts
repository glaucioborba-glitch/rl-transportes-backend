import type { TorreControleResponse, VisaoOperacionalResponse } from "@/lib/api/bi-analytics-types";
import { staffJson } from "@/lib/api/staff-client";

export function fetchTorreControle() {
  return staffJson<TorreControleResponse>("/bi-analytics/torre-de-controle");
}

export function fetchVisaoOperacional() {
  return staffJson<VisaoOperacionalResponse>("/bi-analytics/visao-operacional");
}
