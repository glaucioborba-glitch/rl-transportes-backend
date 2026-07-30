import type { PrismaService } from '../../src/prisma/prisma.service';
import type { TenantContextService } from '../../src/tenant/tenant-context.service';
import { IntegracaoEventLogStore } from '../../src/integracao-mobilidade/stores/integracao-event-log.store';

/** Prisma + tenant mínimos para stores write-through em unit tests. */
export function mockTenantContext(tenantId = 'default'): TenantContextService {
  return { getTenantId: () => tenantId } as TenantContextService;
}

export function createIntegracaoEventLogStoreForTest(
  prisma?: Partial<PrismaService>,
): IntegracaoEventLogStore {
  const store = {
    integracaoEventLog: {
      create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: data.id,
        tipo: data.tipo,
        payload: data.payload,
        clienteId: data.clienteId ?? null,
        correlationId: data.correlationId ?? null,
        createdAt: new Date(),
      })),
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    ...(prisma ?? {}),
  } as unknown as PrismaService;
  return new IntegracaoEventLogStore(store, mockTenantContext());
}
