import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PasswordPolicyService } from '../common/security/password-policy.service';
import { isPortalPrincipalTenant } from '../common/constants/portal-tenant-roles.util';
import { normalizeLoginDocumento } from '../common/utils/login-documento.util';
import { validateCnpjDigits } from '../common/utils/br-documents';
import type { CxPortalRequestUser } from '../cx-portais/types/cx-portal.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransportadoraAutorizadaDto } from './dto/create-transportadora.dto';

@Injectable()
export class TransportadorasAutorizadasService {
  private static readonly BCRYPT_ROUNDS = 12;

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordPolicy: PasswordPolicyService,
  ) {}

  private assertGestaoEquipe(cx: CxPortalRequestUser): string {
    if (cx.portalPapel !== 'CLIENTE' || !cx.clienteId) {
      throw new ForbiddenException('Somente cliente autenticado no portal.');
    }
    if (!isPortalPrincipalTenant(cx)) {
      throw new ForbiddenException('Transportadoras não podem gerenciar equipe.');
    }
    if (!cx.pessoaAutorizada?.id) {
      throw new ForbiddenException('Selecione sua identidade antes de continuar.');
    }
    return cx.clienteId;
  }

  async listar(cx: CxPortalRequestUser, clienteId: string) {
    if (cx.portalPapel !== 'CLIENTE' || cx.clienteId !== clienteId) {
      throw new ForbiddenException('Acesso negado.');
    }
    return this.prisma.transportadoraAutorizada.findMany({
      where: { clienteId },
      orderBy: { razaoSocial: 'asc' },
      select: {
        id: true,
        cnpj: true,
        razaoSocial: true,
        emailContato: true,
        ativo: true,
        createdAt: true,
      },
    });
  }

  async criar(cx: CxPortalRequestUser, dto: CreateTransportadoraAutorizadaDto) {
    const clienteId = this.assertGestaoEquipe(cx);
    const cnpj = normalizeLoginDocumento(dto.cnpj);
    if (cnpj.length !== 14 || !validateCnpjDigits(cnpj)) {
      throw new ConflictException('CNPJ inválido.');
    }

    this.passwordPolicy.assertStrong(dto.password);

    const dupUser = await this.prisma.user.findFirst({ where: { cpfCnpj: cnpj } });
    if (dupUser) throw new ConflictException('CNPJ já possui usuário cadastrado no sistema.');

    const dupCliente = await this.prisma.cliente.findFirst({
      where: { cpfCnpj: cnpj, deletedAt: null },
    });
    if (dupCliente) {
      throw new ConflictException('CNPJ já cadastrado como cliente principal.');
    }

    const existente = await this.prisma.transportadoraAutorizada.findFirst({
      where: { clienteId, cnpj },
    });
    if (existente) throw new ConflictException('Transportadora já autorizada para esta empresa.');

    const email = dto.emailContato.trim().toLowerCase();
    const dupMail = await this.prisma.user.findFirst({ where: { email } });
    if (dupMail) throw new ConflictException('E-mail de contato já cadastrado.');

    const hash = await bcrypt.hash(dto.password, TransportadorasAutorizadasService.BCRYPT_ROUNDS);

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          cpfCnpj: cnpj,
          email,
          password: hash,
          role: Role.TRANSPORTADORA_TERCEIRA,
          clienteId,
        },
      });
      return tx.transportadoraAutorizada.create({
        data: {
          clienteId,
          cnpj,
          razaoSocial: dto.razaoSocial.trim(),
          emailContato: email,
          userId: user.id,
        },
        select: {
          id: true,
          cnpj: true,
          razaoSocial: true,
          emailContato: true,
          ativo: true,
          createdAt: true,
        },
      });
    });
  }

  async alternarAtivo(cx: CxPortalRequestUser, id: string, ativo: boolean) {
    const clienteId = this.assertGestaoEquipe(cx);
    const row = await this.prisma.transportadoraAutorizada.findFirst({
      where: { id, clienteId },
    });
    if (!row) throw new NotFoundException('Transportadora autorizada não encontrada.');
    return this.prisma.transportadoraAutorizada.update({
      where: { id },
      data: { ativo },
      select: {
        id: true,
        cnpj: true,
        razaoSocial: true,
        emailContato: true,
        ativo: true,
      },
    });
  }
}
