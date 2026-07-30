import type { Page, Route } from "@playwright/test";
import {
  buildColetaSolicitacao,
  buildMinhasPermissoesResponse,
  buildPortalDashboardResponse,
  buildPortalLoginResponse,
  buildStaffLoginResponse,
  buildTriagemPendente,
  buildCadastroPendenteRow,
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

const CONDICOES_PAGAMENTO_MOCK = [
  { label: "Faturamento", value: "FATURAMENTO" },
  { label: "À Vista PIX", value: "AVISTA_PIX" },
];

/** Cadastros financeiros pendentes — fila + aprovação mockada. */
export async function setupStaffCadastrosPendentesMocks(page: Page) {
  let aprovado = false;

  await page.route((url) => url.href.includes(":3001/") || url.href.includes("/api/"), async (route) => {
    const path = apiPath(route.request().url());
    const method = route.request().method();

    if (path === "/financeiro/cadastros-pendentes/condicoes-pagamento" && method === "GET") {
      await fulfillJson(route, CONDICOES_PAGAMENTO_MOCK);
      return;
    }

    if (path === "/financeiro/cadastros-pendentes" && method === "GET") {
      await fulfillJson(route, aprovado ? [] : [buildCadastroPendenteRow()]);
      return;
    }

    if (path === "/financeiro/pendencias-count" && method === "GET") {
      await fulfillJson(route, { count: aprovado ? 0 : 1 });
      return;
    }

    if (path.includes("/financeiro/cadastros-pendentes/") && path.endsWith("/aprovar") && method === "POST") {
      aprovado = true;
      await fulfillJson(route, { ok: true });
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

export const E2E_GATE_PROTOCOL = "RL-2026-001";
export const E2E_GATE_IN_ID = "e2e-gate-in-001";

type OperacaoState =
  | "AGUARDANDO_CHEGADA"
  | "CHECKIN_PORTARIA"
  | "VISTORIA_FOTOGRAFICA"
  | "AGUARDANDO_RECONFIRMACAO"
  | "RECONFIRMADA"
  | "RIC_GERADO"
  | "LIBERADA_OPERACAO"
  | "EM_OPERACAO"
  | "CONCLUIDA";

function buildOperacaoMock(state: OperacaoState) {
  return {
    id: "op-e2e-1",
    protocolo: E2E_GATE_PROTOCOL,
    state,
    stateLabel: state,
    containerNumero: "MSCU1234567",
    containerTipo: "DRY",
    containerTamanho: "20'",
    containerSituacao: "CHEIO",
    placa: "ABC-1234",
    motoristaNome: "João Silva",
    transportadoraNome: "Transportes Demo",
    clienteNome: "Cliente Demo LTDA",
    tipoOperacao: "GATE_IN",
    tatInicio: state === "EM_OPERACAO" ? new Date().toISOString() : null,
    tatFim: null,
  };
}

/** Mocks do fluxo operacional portaria/gate (`/v2/gate/*`). */
export async function setupGateOperacaoMocks(page: Page) {
  let operacaoState: OperacaoState = "AGUARDANDO_CHEGADA";

  await page.route((url) => url.href.includes("/v2/gate") || url.href.includes("/v2/ocr"), async (route) => {
    const path = apiPath(route.request().url());
    const method = route.request().method();

    if (path === "/v2/gate/portaria/stats" && method === "GET") {
      await fulfillJson(route, {
        aguardandoChegada: 1,
        emVistoria: 0,
        aguardandoGate: 0,
        concluidasHoje: 0,
      });
      return;
    }

    if (path.startsWith("/v2/gate/aguardando-chegada") && method === "GET") {
      await fulfillJson(route, {
        items: [
          {
            protocolo: E2E_GATE_PROTOCOL,
            containerNumero: "MSCU1234567",
            containerTipo: "DRY",
            placa: "ABC-1234",
            clienteNome: "Cliente Demo LTDA",
          },
        ],
      });
      return;
    }

    const opGet = path.match(/^\/v2\/gate\/operacoes\/([^/]+)$/);
    if (opGet && method === "GET") {
      await fulfillJson(route, buildOperacaoMock(operacaoState));
      return;
    }

    if (path.match(/\/v2\/gate\/operacoes\/[^/]+\/checkin$/) && method === "POST") {
      operacaoState = "CHECKIN_PORTARIA";
      await fulfillJson(route, buildOperacaoMock(operacaoState), 201);
      return;
    }

    if (path.match(/\/v2\/gate\/operacoes\/[^/]+\/vistoria$/) && method === "POST") {
      operacaoState = "VISTORIA_FOTOGRAFICA";
      await fulfillJson(route, buildOperacaoMock(operacaoState), 201);
      return;
    }

    if (path === "/v2/ocr/processar" && method === "POST") {
      await fulfillJson(route, {
        sucesso: true,
        texto: "MSCU1234567",
        confianca: 0.95,
        provider: "e2e-mock",
        ocrMatch: true,
      });
      return;
    }

    if (path.match(/\/v2\/gate\/operacoes\/[^/]+\/reconfirmar$/) && method === "POST") {
      operacaoState = "RECONFIRMADA";
      await fulfillJson(route, buildOperacaoMock(operacaoState));
      return;
    }

    if (path.match(/\/v2\/gate\/operacoes\/[^/]+\/liberar-operacao$/) && method === "POST") {
      operacaoState = "LIBERADA_OPERACAO";
      await fulfillJson(route, buildOperacaoMock(operacaoState));
      return;
    }

    if (path.match(/\/v2\/gate\/operacoes\/[^/]+\/iniciar$/) && method === "POST") {
      operacaoState = "EM_OPERACAO";
      await fulfillJson(route, buildOperacaoMock(operacaoState));
      return;
    }

    if (path.match(/\/v2\/gate\/operacoes\/[^/]+\/concluir$/) && method === "POST") {
      operacaoState = "CONCLUIDA";
      await fulfillJson(route, buildOperacaoMock(operacaoState));
      return;
    }

    if (path.match(/\/v2\/gate\/operacoes\/[^/]+\/ric-pdf$/) && method === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/pdf",
        body: Buffer.from("%PDF-1.4 e2e mock ric"),
      });
      return;
    }

    if (path === "/v2/cadastros/operacional-vinculo/equipamento-atual" && method === "GET") {
      await fulfillJson(route, { id: "eq-1", codigo: "RTG-01", marca: "Kalmar", modelo: "E2E" });
      return;
    }

    await route.continue();
  });
}

export type HoldReleaseMockOptions = {
  bloqueioAtivo: boolean;
  tipo?: "FINANCEIRO" | "OPERACIONAL";
  pagamentoConfirmado?: boolean;
};

/** Mocks gate check-out com bloqueio hold/release. */
export async function setupHoldReleaseMocks(page: Page, options: HoldReleaseMockOptions) {
  await page.route((url) => url.href.includes("/v2/gate/check-ins"), async (route) => {
    const path = apiPath(route.request().url());
    const method = route.request().method();

    if (path.match(/\/pre-checkout$/) && method === "GET") {
      await fulfillJson(route, {
        gateIn: { placaCavalo: "ABC-1234", placaCarreta01: "XYZ-9876", divergenciasJson: [] },
        solicitacao: {
          protocolo: E2E_GATE_PROTOCOL,
          containersSolicitacao: [{ unidade: "MSCU1234567", ordem: 1 }],
        },
      });
      return;
    }

    if (path.match(/\/check-out$/) && method === "POST") {
      if (options.bloqueioAtivo && options.tipo === "OPERACIONAL") {
        await fulfillJson(
          route,
          {
            statusCode: 403,
            message: "Contêiner com bloqueio operacional ativo. Solicite liberação ao supervisor.",
            bloqueioId: "blk-123",
            tipo: "OPERACIONAL",
          },
          403,
        );
        return;
      }
      if (options.bloqueioAtivo && !options.pagamentoConfirmado) {
        await fulfillJson(
          route,
          {
            statusCode: 403,
            message: "Contêiner bloqueado financeiramente. Regularize o pagamento ou solicite liberação manual.",
            bloqueioId: "blk-123",
            tipo: options.tipo ?? "FINANCEIRO",
          },
          403,
        );
        return;
      }
      await fulfillJson(route, { status: "CONCLUIDA", autoReleased: Boolean(options.pagamentoConfirmado) }, 201);
      return;
    }

    await route.continue();
  });
}
