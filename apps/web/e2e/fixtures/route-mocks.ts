import type { Page, Route } from "@playwright/test";
import {
  buildColetaSolicitacao,
  buildMinhasPermissoesResponse,
  buildPortalDashboardResponse,
  buildPortalLoginResponse,
  buildStaffLoginResponse,
  buildTriagemPendente,
  buildE2ePortalSessionPayload,
  E2E_SOLICITACAO_ID,
  E2E_TRIAGEM_ID,
} from "./mock-data";

type JsonBody = Record<string, unknown> | unknown[] | null;

function jsonResponse(body: JsonBody, status = 200) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  };
}

async function fulfillJson(route: Route, body: JsonBody, status = 200) {
  await route.fulfill(jsonResponse(body, status));
}

/** Normaliza URL do BFF (`/api/portal/proxy/...`) ou API direta (`http://host/...`). */
function apiPath(url: string): string {
  try {
    const u = new URL(url);
    const proxy = u.pathname.match(/^\/api\/portal\/proxy(\/.*)$/);
    if (proxy) return proxy[1];
    return u.pathname;
  } catch {
    return url;
  }
}

function isPortalApi(url: string): boolean {
  return (
    url.includes("/api/portal/") ||
    url.includes("/portal/") ||
    url.includes("/cliente/portal/") ||
    url.includes(":3001")
  );
}

function isStaffApi(url: string): boolean {
  return (
    url.includes("/v1/agendamentos/triagem") ||
    url.includes(":3001/v1/") ||
    url.includes(":3001/auth/")
  );
}

function buildStaffMeResponse() {
  const staff = buildStaffLoginResponse().user;
  return {
    sub: staff.id,
    id: staff.id,
    email: staff.email,
    cpfCnpj: staff.cpfCnpj,
    role: staff.role,
    permissions: staff.permissions,
    clienteId: staff.clienteId ?? null,
  };
}

/** Intercepta APIs do portal (JWT direto ou BFF `/api/portal/proxy`). */
export async function setupPortalApiMocks(page: Page, opts?: { solicitacao?: ReturnType<typeof buildColetaSolicitacao> }) {
  const solicitacao = opts?.solicitacao ?? buildColetaSolicitacao();

  await page.route((url) => isPortalApi(url.href) || url.href.endsWith("/health"), async (route) => {
    const path = apiPath(route.request().url());
    const method = route.request().method();

    if ((path === "/portal/login" || path === "/api/portal/login") && method === "POST") {
      await fulfillJson(route, buildPortalLoginResponse());
      return;
    }

    if (path === "/portal/auth/minhas-permissoes" && method === "GET") {
      await fulfillJson(route, buildMinhasPermissoesResponse());
      return;
    }

    if (path.startsWith("/cliente/portal/dashboard") && method === "GET") {
      await fulfillJson(route, buildPortalDashboardResponse());
      return;
    }

    if (path === "/health" && method === "GET") {
      await fulfillJson(route, {
        api: "ok",
        database: "ok",
        redis: "ok",
        securityEngine: "ok",
      });
      return;
    }

    if (/^\/portal\/v2\/solicitacoes(?:\/com-anexos)?$/.test(path) && method === "POST") {
      await fulfillJson(route, solicitacao, 201);
      return;
    }

    if (path.startsWith(`/cliente/portal/solicitacoes/${E2E_SOLICITACAO_ID}`)) {
      if (path.endsWith("/historico-alteracoes")) {
        await fulfillJson(route, { solicitacaoId: E2E_SOLICITACAO_ID, items: [] });
        return;
      }
      await fulfillJson(route, solicitacao);
      return;
    }

    if (path.startsWith("/cliente/portal/solicitacoes") && method === "GET") {
      await fulfillJson(route, {
        items: [solicitacao],
        total: 1,
        page: 1,
        limit: 10,
        meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
      });
      return;
    }

    if (path === "/api/portal/me" && method === "GET") {
      await fulfillJson(route, buildPortalLoginResponse());
      return;
    }

    await route.continue();
  });
}

/** Intercepta auth staff (BFF Next + API direta) para evitar logout pelo heartbeat `/api/auth/health`. */
export async function setupStaffAuthMock(page: Page) {
  const meBody = buildStaffMeResponse();

  await page.route(/\/api\/auth\/(login|health|me|refresh)$/i, async (route) => {
    const path = apiPath(route.request().url());
    const method = route.request().method();

    if (path.endsWith("/login") && method === "POST") {
      await fulfillJson(route, buildStaffLoginResponse());
      return;
    }
    if (path.endsWith("/health") && method === "GET") {
      await fulfillJson(route, { ok: true, renewed: false });
      return;
    }
    if (path.endsWith("/me") && method === "GET") {
      await fulfillJson(route, meBody);
      return;
    }
    if (path.endsWith("/refresh") && method === "POST") {
      await fulfillJson(route, buildStaffLoginResponse());
      return;
    }
    await route.continue();
  });

  await page.route((url) => url.href.includes(":3001/auth/"), async (route) => {
    const path = apiPath(route.request().url());
    const method = route.request().method();

    if (path === "/auth/login" && method === "POST") {
      await fulfillJson(route, buildStaffLoginResponse());
      return;
    }
    if (path === "/auth/health" && method === "GET") {
      await fulfillJson(route, { ok: true, renewed: false });
      return;
    }
    if (path === "/auth/me" && method === "GET") {
      await fulfillJson(route, meBody);
      return;
    }
    if (path === "/auth/refresh" && method === "POST") {
      await fulfillJson(route, buildStaffLoginResponse());
      return;
    }
    await route.continue();
  });
}

/** Triagem intranet — lista pendente + aprovação mockada. */
export async function setupStaffTriagemMocks(page: Page) {
  let aprovado = false;

  await page.route((url) => isStaffApi(url.href), async (route) => {
    const path = apiPath(route.request().url());
    const method = route.request().method();

    if (path.endsWith("/pendentes") && method === "GET") {
      await fulfillJson(route, aprovado ? [] : [buildTriagemPendente()]);
      return;
    }

    if (path.includes("/aprovar") && method === "POST") {
      aprovado = true;
      await fulfillJson(route, { ok: true, status: "APROVADO", id: E2E_TRIAGEM_ID });
      return;
    }

    if (path.startsWith("/auth/")) {
      await route.continue();
      return;
    }

    await route.continue();
  });
}

export async function seedPortalPessoaStorage(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      "pessoaAutorizada",
      JSON.stringify({
        state: {
          pessoa: {
            id: "e2e-pessoa-id",
            nome: "Responsável QA",
            email: "responsavel.qa@rl-transportes.test",
            telefone: "11999990000",
          },
        },
        version: 0,
      }),
    );
  });
}

/** Persiste sessão portal no `sessionStorage` (sobrevive a reloads do Playwright). */
export async function saveE2ePortalSession(page: Page) {
  const payload = buildE2ePortalSessionPayload();
  await page.evaluate((data) => {
    sessionStorage.setItem("e2e-portal-session", JSON.stringify(data));
  }, payload);
}
