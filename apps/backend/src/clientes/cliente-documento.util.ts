import { ConflictException } from '@nestjs/common';
import { TipoCliente } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';

/** Normaliza CPF (11 → 14 com zeros) ou CNPJ (14) para armazenamento em `Cliente.cpfCnpj` / `User.cpfCnpj`. */
export function normalizeClienteDocumentoStorage(
  raw: string,
  tipo?: TipoCliente,
): string {
  const d = raw.replace(/\D/g, '');
  if (d.length === 11 || tipo === TipoCliente.PF) {
    const cpf = d.length <= 11 ? d : d.slice(-11);
    return cpf.padStart(14, '0');
  }
  if (d.length === 14 || tipo === TipoCliente.PJ) {
    return d.length === 14 ? d : d.padStart(14, '0').slice(-14);
  }
  return d;
}

function mensagemDocumentoDuplicado(tipo: TipoCliente | null | undefined): string {
  if (tipo === TipoCliente.PF) {
    return 'CPF já cadastrado. Cada pessoa física pode ter apenas um cadastro no sistema.';
  }
  if (tipo === TipoCliente.PJ) {
    return 'CNPJ já cadastrado. Cada empresa pode ter apenas um cadastro no sistema.';
  }
  return 'CPF/CNPJ já cadastrado. Não é possível cadastrar o mesmo documento mais de uma vez.';
}

/**
 * Garante unicidade global do documento (Cliente + User portal).
 * Inclui registros soft-deleted — não permite segundo cadastro com o mesmo CPF/CNPJ.
 */
export async function assertClienteDocumentoDisponivel(
  prisma: PrismaService,
  cpfCnpj: string,
  opts?: { tipo?: TipoCliente; excludeClienteId?: string; tenantId?: string },
): Promise<void> {
  const doc = normalizeClienteDocumentoStorage(cpfCnpj, opts?.tipo);
  const tenantId = opts?.tenantId ?? 'default';

  const cliente = await prisma.cliente.findFirst({ where: { tenantId, cpfCnpj: doc } });
  if (cliente && cliente.id !== opts?.excludeClienteId) {
    throw new ConflictException(mensagemDocumentoDuplicado(cliente.tipo));
  }

  const user = await prisma.user.findFirst({ where: { tenantId, cpfCnpj: doc } });
  if (user && user.clienteId !== opts?.excludeClienteId) {
    const tipo =
      opts?.tipo ??
      (doc.replace(/^0+/, '').length <= 11 ? TipoCliente.PF : TipoCliente.PJ);
    throw new ConflictException(mensagemDocumentoDuplicado(tipo));
  }
}
