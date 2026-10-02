import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { INTRANET_STAFF_ROLE_LIST } from '../common/constants/intranet-staff-roles.util';
import { normalizeLoginDocumento } from '../common/utils/login-documento.util';

const BCRYPT_ROUNDS = 12;

export const COLABORADOR_INTRANET_PERFIS = INTRANET_STAFF_ROLE_LIST;

const PERFIL_SET = new Set<string>(COLABORADOR_INTRANET_PERFIS);

export type ColaboradorLoginInput = {
  perfilIntranet?: string | null;
  senha?: string | null;
  senhaConfirmacao?: string | null;
  email?: string | null;
};

export function stripColaboradorLoginSecrets<T extends Record<string, unknown>>(
  dto: T,
): Omit<T, 'senha' | 'senhaConfirmacao'> {
  const { senha: _s, senhaConfirmacao: _c, ...rest } = dto as T & {
    senha?: unknown;
    senhaConfirmacao?: unknown;
  };
  return rest;
}

export function parsePerfilIntranet(raw?: string | null): Role | null {
  const value = raw?.trim();
  if (!value) return null;
  if (!PERFIL_SET.has(value)) {
    throw new BadRequestException(
      'Perfil de acesso inválido. Use Gate CPO, Portaria, Pátio, Gerencial ou Administrativo.',
    );
  }
  return value as Role;
}

export function assertSenhasIguais(senha?: string | null, confirmacao?: string | null) {
  if ((senha ?? '') !== (confirmacao ?? '')) {
    throw new BadRequestException('A senha e a confirmação não conferem.');
  }
}

export async function upsertColaboradorIntranetUser(
  tx: Prisma.TransactionClient,
  params: {
    tenantId: string;
    cpf: string;
    email: string;
    role: Role;
    passwordPlain?: string | null;
  },
): Promise<{ id: string; role: Role; email: string }> {
  const cpfCnpj = normalizeLoginDocumento(params.cpf);
  const email = params.email.trim().toLowerCase();
  if (!email) {
    throw new BadRequestException('E-mail é obrigatório para criar o acesso à intranet.');
  }

  const existingByCpf = await tx.user.findFirst({
    where: { tenantId: params.tenantId, cpfCnpj },
  });
  if (existingByCpf?.role === Role.SUPER_ADMIN) {
    throw new ConflictException('Este CPF pertence ao Super Admin e não pode ser alterado pelo RH.');
  }
  if (
    existingByCpf &&
    (existingByCpf.role === Role.CLIENTE ||
      existingByCpf.role === Role.ADMIN_CLIENTE ||
      existingByCpf.role === Role.TRANSPORTADORA_TERCEIRA)
  ) {
    throw new ConflictException('Este CPF já é login de portal e não pode virar acesso da intranet.');
  }

  const emailTaken = await tx.user.findFirst({
    where: {
      tenantId: params.tenantId,
      email,
      ...(existingByCpf ? { NOT: { id: existingByCpf.id } } : {}),
    },
    select: { id: true },
  });
  if (emailTaken) {
    throw new ConflictException('Este e-mail já está em uso por outro usuário.');
  }

  let passwordHash: string | undefined;
  if (params.passwordPlain) {
    passwordHash = await bcrypt.hash(params.passwordPlain, BCRYPT_ROUNDS);
  } else if (!existingByCpf) {
    throw new BadRequestException('Senha é obrigatória no primeiro acesso à intranet.');
  }

  if (existingByCpf) {
    const updated = await tx.user.update({
      where: { id: existingByCpf.id },
      data: {
        email,
        role: params.role,
        ...(passwordHash ? { password: passwordHash, tokenVersion: { increment: 1 } } : {}),
      },
      select: { id: true, role: true, email: true },
    });
    return updated;
  }

  return tx.user.create({
    data: {
      tenantId: params.tenantId,
      cpfCnpj,
      email,
      password: passwordHash!,
      role: params.role,
    },
    select: { id: true, role: true, email: true },
  });
}
