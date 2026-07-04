import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { Role, StatusCadastroCliente, TipoCliente, ValidacaoDominio } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { EmailService } from '../../common/email/email.service';
import { PasswordPolicyService } from '../../common/security/password-policy.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { PortalPapel, PortalRefreshTokenPayload } from '../types/cx-portal.types';
import { PortalFornecedorIdentitiesStore } from '../stores/portal-fornecedor-identities.store';
import { PortalJwtService } from './portal-jwt.service';
import { PortalRegisterDto } from '../dto/portal-register.dto';
import {
  assertClienteDocumentoDisponivel,
  normalizeClienteDocumentoStorage,
} from '../../clientes/cliente-documento.util';
import { clienteCreateInputFromDto } from '../../clientes/cliente-fiscal.mapper';
import { normalizeLoginDocumento } from '../../common/utils/login-documento.util';
import { canPortalClienteLogin, isTransportadoraTerceiraRole } from '../../common/constants/portal-tenant-roles.util';
import { TRANSPORTADORA_PERMISSOES_FIXAS } from '../../common/constants/transportadora-permissoes.constants';
import { AddressService } from '../../common/address/address.service';
import { DEFAULT_TENANT_ID } from '../../tenant/tenant.constants';
import { userWhereByDocumento } from '../../tenant/tenant-prisma.util';
import {
  applyNormalizedToCreateDto,
  postalInputFromCreateDto,
} from '../../common/address/cliente-address-bridge';
import type { CreateClienteDto } from '../../clientes/dto/create-cliente.dto';
import type { Request } from 'express';
import { SessionService } from '../../auth/session/session.service';
import { DeviceService } from '../../auth/session/device.service';
import { parseDurationToSeconds } from '../../auth/session/session.util';
import { LoginTelemetryService } from '../../security-center/login-telemetry.service';
import type { AuthChannel } from '../../auth/session/session.types';
import { PessoasAutorizadasService } from '../../pessoas-autorizadas/pessoas-autorizadas.service';
import type { CreatePessoaAutorizadaDto } from '../../pessoas-autorizadas/dto/create-pessoa-autorizada.dto';
import type { PessoaAutorizadaSession } from '../../pessoas-autorizadas/pessoa-autorizada.types';
import type { CxPortalRequestUser } from '../types/cx-portal.types';
import { TermosUsoService } from '../../common/legal/termos-uso.service';
import { extractRequestIp } from '../../common/utils/request-ip.util';
import { DominioCorporativoValidatorService } from '../../common/validation/dominio-corporativo-validator.service';
import { TransportadorasAutorizadasService } from '../../transportadoras-autorizadas/transportadoras-autorizadas.service';

@Injectable()
export class PortalIdentityService {
  private readonly logger = new Logger(PortalIdentityService.name);
  private static readonly BCRYPT_ROUNDS = 12;

  constructor(
    private readonly prisma: PrismaService,
    private readonly fornecedores: PortalFornecedorIdentitiesStore,
    private readonly portalJwt: PortalJwtService,
    private readonly config: ConfigService,
    private readonly passwordPolicy: PasswordPolicyService,
    private readonly emailService: EmailService,
    private readonly addressService: AddressService,
    private readonly session: SessionService,
    private readonly device: DeviceService,
    private readonly loginTelemetry: LoginTelemetryService,
    private readonly pessoasAutorizadas: PessoasAutorizadasService,
    private readonly termosUso: TermosUsoService,
    private readonly dominioValidator: DominioCorporativoValidatorService,
    private readonly transportadorasAutorizadas: TransportadorasAutorizadasService,
  ) {}

  /** Base pública do portal para montar links em e-mails e recuperação. */
  private portalPublicBase(): string {
    const raw =
      this.config.get<string>('PORTAL_RESET_LINK_BASE')?.trim() ||
      this.config.get<string>('PORTAL_PUBLIC_WEB_ORIGIN')?.trim() ||
      process.env.PORTAL_PUBLIC_WEB_ORIGIN?.trim() ||
      process.env.NEXT_PUBLIC_APP_URL?.trim();
    return raw ? raw.replace(/\/$/, '') : 'https://app.rltransportes.com.br';
  }

  private sessionTtlSeconds(): number {
    return parseDurationToSeconds(
      this.config.get<string>('PORTAL_JWT_REFRESH_EXPIRES_IN') ?? '7d',
    );
  }

  private parseCpfCnpjParaCliente(raw: string): { cpfCnpj: string; tipo: TipoCliente } {
    const d = raw.replace(/\D/g, '');
    if (d.length === 11) {
      return { cpfCnpj: normalizeClienteDocumentoStorage(d, TipoCliente.PF), tipo: TipoCliente.PF };
    }
    if (d.length === 14) {
      return { cpfCnpj: normalizeClienteDocumentoStorage(d, TipoCliente.PJ), tipo: TipoCliente.PJ };
    }
    throw new BadRequestException('Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.');
  }

  /** Termos de Uso ativos para exibição no cadastro portal. */
  getTermosUsoAtivo() {
    return this.termosUso.getAtivo();
  }

  /** Cadastro self-service: `User` CLIENTE + `Cliente` vinculado (dados fiscais NFS-e). */
  async registrarClientePortal(input: PortalRegisterDto, req?: Request) {
    const { password, pessoasAutorizadas, transportadorasAutorizadas, aceiteTermos, ...fiscal } = input;
    if (!aceiteTermos) {
      throw new BadRequestException('É necessário aceitar os Termos de Uso e Condições Gerais.');
    }
    const email = fiscal.email.trim().toLowerCase();
    const nomeOk =
      fiscal.tipo === TipoCliente.PF
        ? fiscal.nomeCompleto?.trim()
        : fiscal.razaoSocial?.trim();
    if (!nomeOk) {
      throw new BadRequestException(
        fiscal.tipo === TipoCliente.PF
          ? 'Nome completo é obrigatório.'
          : 'Razão social é obrigatória.',
      );
    }

    this.passwordPolicy.assertStrong(password);

    const dupUser = await this.prisma.user.findFirst({ where: { email } });
    if (dupUser) throw new ConflictException('E-mail já cadastrado.');

    const dupClienteMail = await this.prisma.cliente.findFirst({
      where: { email, deletedAt: null },
    });
    if (dupClienteMail) throw new ConflictException('E-mail já cadastrado.');

    const parsed = this.parseCpfCnpjParaCliente(fiscal.cpfCnpj);
    if (fiscal.tipo !== parsed.tipo) {
      throw new BadRequestException('O tipo (PF/PJ) deve corresponder ao CPF ou CNPJ informado.');
    }
    if (fiscal.tipo === TipoCliente.PJ) {
      const nf = fiscal.nomeFantasia?.trim();
      if (!nf) throw new BadRequestException('Nome fantasia é obrigatório para pessoa jurídica.');
    }

    await assertClienteDocumentoDisponivel(this.prisma, parsed.cpfCnpj, { tipo: parsed.tipo });

    const hash = await bcrypt.hash(password, PortalIdentityService.BCRYPT_ROUNDS);
    const fiscalDto = { ...fiscal } as CreateClienteDto;
    const normalizedAddr = await this.addressService.normalize(postalInputFromCreateDto(fiscalDto));
    applyNormalizedToCreateDto(fiscalDto, normalizedAddr);
    const data = clienteCreateInputFromDto(fiscalDto);
    data.tipo = parsed.tipo;
    data.cpfCnpj = parsed.cpfCnpj;
    data.termosAceitosEm = new Date();
    data.termosAceitosIp = extractRequestIp(req);
    data.termosVersao = await this.termosUso.resolveVersaoAtiva();

    let validacaoDominio: ValidacaoDominio = ValidacaoDominio.INDISPONIVEL;
    if (parsed.tipo === TipoCliente.PJ) {
      validacaoDominio = await this.dominioValidator.validar(parsed.cpfCnpj, email);
    }
    data.validacaoDominio = validacaoDominio;
    data.statusCadastro = StatusCadastroCliente.PENDENTE_ANALISE_FINANCEIRA;

    const empresaNome =
      parsed.tipo === TipoCliente.PF
        ? fiscal.nomeCompleto?.trim() || email
        : fiscal.razaoSocial?.trim() || email;

    await this.prisma.$transaction(async (tx) => {
      const cliente = await tx.cliente.create({ data });
      await tx.user.create({
        data: {
          cpfCnpj: parsed.cpfCnpj,
          email,
          password: hash,
          role: Role.ADMIN_CLIENTE,
          clienteId: cliente.id,
        },
      });
      return cliente.id;
    }).then(async (clienteId) => {
      let pessoas =
        pessoasAutorizadas?.length && pessoasAutorizadas.length > 0
          ? pessoasAutorizadas
          : this.defaultPessoasFromRegister(fiscal as CreateClienteDto);
      if (parsed.tipo === TipoCliente.PF && pessoas.length === 0) {
        pessoas = this.buildTitularPfObrigatorio(fiscal as CreateClienteDto);
      }
      if (parsed.tipo === TipoCliente.PF && pessoas.length === 0) {
        throw new BadRequestException(
          'Não foi possível registrar o titular (PF). Verifique nome completo e CPF.',
        );
      }
      await this.pessoasAutorizadas.criarEmLote(clienteId, pessoas);
      if (transportadorasAutorizadas?.length) {
        await this.transportadorasAutorizadas.criarEmLoteNoCadastro(
          clienteId,
          transportadorasAutorizadas,
          hash,
        );
      }
    });

    void this.emailService
      .sendFinanceiroNovoCadastro({
        empresa: empresaNome,
        cnpj: parsed.cpfCnpj,
        email,
        validacaoDominio,
      })
      .catch((e) =>
        this.logger.warn(
          `Notificação financeiro cadastro portal falhou: ${e instanceof Error ? e.message : e}`,
        ),
      );

    return {
      ok: true as const,
      message: 'Cadastro realizado. Faça login para continuar.',
    };
  }

  /** Titular PF obrigatório no cadastro portal (acesso pessoal único). */
  private buildTitularPfObrigatorio(fiscal: CreateClienteDto): CreatePessoaAutorizadaDto[] {
    const nome = fiscal.nomeCompleto?.trim() || fiscal.razaoSocial?.trim();
    if (!nome) return [];
    const cpfPf = fiscal.cpfCnpj.replace(/\D/g, '').slice(-11);
    if (cpfPf.length !== 11) return [];
    const tel =
      fiscal.telefoneContato?.replace(/\D/g, '') ||
      fiscal.telefone?.replace(/\D/g, '') ||
      '';
    if (!tel) return [];
    return [
      {
        nome,
        email: fiscal.email.trim().toLowerCase(),
        cpf: cpfPf,
        telefone: tel,
        permissoes: { podeGerenciarPessoas: true },
      },
    ];
  }

  private defaultPessoasFromRegister(fiscal: CreateClienteDto): CreatePessoaAutorizadaDto[] {
    if (fiscal.tipo === TipoCliente.PF) {
      return this.buildTitularPfObrigatorio(fiscal);
    }
    const nome = fiscal.responsavel?.trim();
    const emailResp = (
      fiscal.responsavelEmail?.trim().toLowerCase() ||
      fiscal.emailNfse?.trim().toLowerCase() ||
      fiscal.email.trim().toLowerCase()
    );
    const tel = fiscal.responsavelTelefone?.replace(/\D/g, '');
    if (!nome || !emailResp || !tel) return [];
    // PJ: CPF da pessoa autorizada vem do cadastro (pessoasAutorizadas); sem CPF não há fallback automático.
    return [];
  }

  /** Solicita reset; resposta genérica (não revela se o e-mail existe). Log mock até SMTP. */
  async pedirRecuperacaoSenha(emailRaw: string) {
    const email = emailRaw.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({ where: { email } });
    const msg =
      'Se o e-mail existir em nossa base, você receberá instruções para redefinir a senha.';

    if (!user || !canPortalClienteLogin(user.role) || !user.clienteId) {
      return { ok: true as const, message: msg };
    }

    await this.prisma.portalPasswordReset.deleteMany({ where: { userId: user.id } });
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await this.prisma.portalPasswordReset.create({
      data: { token, userId: user.id, expiresAt },
    });

    const base = this.portalPublicBase();
    const resetUrl = `${base}/portal/redefinir/${token}`;

    let nomeCliente = user.email;
    if (user.clienteId) {
      const c = await this.prisma.cliente.findFirst({
        where: { id: user.clienteId, deletedAt: null },
      });
      if (c?.razaoSocial) nomeCliente = c.razaoSocial;
    }

    try {
      await this.emailService.sendPortalPasswordReset({
        to: email,
        nomeCliente,
        resetUrl,
      });
    } catch {
      this.logger.warn(`Recuperação registrada; falha ao enviar SMTP. Link: ${resetUrl}`);
    }

    return { ok: true as const, message: msg };
  }

  async redefinirSenhaComToken(token: string, novaSenha: string) {
    const row = await this.prisma.portalPasswordReset.findUnique({
      where: { token: token.trim() },
    });
    if (!row || row.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Token inválido ou expirado.');
    }

    this.passwordPolicy.assertStrong(novaSenha);

    const hash = await bcrypt.hash(novaSenha, PortalIdentityService.BCRYPT_ROUNDS);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: row.userId },
        data: {
          password: hash,
          tokenVersion: { increment: 1 },
        },
      }),
      this.prisma.portalPasswordReset.deleteMany({ where: { userId: row.userId } }),
    ]);

    return { ok: true as const, message: 'Senha atualizada. Faça login com a nova senha.' };
  }

  /** Pré-visualização do HTML do e-mail (desenvolvimento / endpoint GET). */
  getResetPreviewHtml(nomeCliente = 'Cliente exemplo', token = 'exemplo-uuid'): string {
    const resetUrl = `${this.portalPublicBase()}/portal/redefinir/${encodeURIComponent(token)}`;
    return this.emailService.renderResetPasswordHtml(nomeCliente, resetUrl);
  }

  private async registerPortalSession(
    principalId: string,
    req: Request | undefined,
    channel: AuthChannel,
  ): Promise<{ sid?: string; fp?: string }> {
    if (!req) return {};
    try {
      const ip = String(req.ip || req.socket?.remoteAddress || '');
      const ua = req.get('user-agent') || '';
      const hdr = this.device.extractHeaders(req);
      const fp = this.device.computeFingerprint(ip, ua, hdr);
      const ttl = parseDurationToSeconds(
        this.config.get<string>('PORTAL_JWT_REFRESH_EXPIRES_IN') ?? '7d',
      );
      const { sessionId } = await this.session.registerSession(
        principalId,
        { fingerprint: fp, ip, userAgent: ua, channel },
        ttl,
      );
      return { sid: sessionId, fp };
    } catch (e) {
      this.logger.warn(`Redis sessão portal: ${(e as Error).message}`);
      return {};
    }
  }

  private formatClienteDoc(cpfCnpj: string): string {
    const d = cpfCnpj.replace(/\D/g, '');
    if (d.length === 14) {
      const tail11 = d.slice(-11);
      if (/^\d{11}$/.test(tail11) && d.startsWith('000')) return tail11;
      return d;
    }
    return d;
  }

  private async resolveClientePortalMeta(
    clienteId: string | null,
    cpfCnpj: string,
  ): Promise<{
    tipo: TipoCliente;
    statusCadastro: StatusCadastroCliente | null;
    validacaoDominio: ValidacaoDominio | null;
    condicaoPagamento: string | null;
    cliente: {
      id: string;
      nomeFantasia: string | null;
      razaoSocial: string | null;
      cpfCnpj: string;
    } | null;
  } | null> {
    if (!clienteId) {
      const docLen = cpfCnpj.replace(/\D/g, '').length;
      if (docLen === 11) {
        return {
          tipo: TipoCliente.PF,
          statusCadastro: null,
          validacaoDominio: null,
          condicaoPagamento: null,
          cliente: null,
        };
      }
      if (docLen === 14) {
        return {
          tipo: TipoCliente.PJ,
          statusCadastro: null,
          validacaoDominio: null,
          condicaoPagamento: null,
          cliente: null,
        };
      }
      return null;
    }
    const cliente = await this.prisma.cliente.findUnique({
      where: { id: clienteId },
      select: {
        id: true,
        tipo: true,
        razaoSocial: true,
        nomeFantasia: true,
        cpfCnpj: true,
        statusCadastro: true,
        validacaoDominio: true,
        condicaoPagamento: true,
      },
    });
    if (!cliente) return null;
    return {
      tipo: cliente.tipo,
      statusCadastro: cliente.statusCadastro,
      validacaoDominio: cliente.validacaoDominio,
      condicaoPagamento: cliente.condicaoPagamento,
      cliente: {
        id: cliente.id,
        nomeFantasia: cliente.nomeFantasia?.trim() || null,
        razaoSocial: cliente.razaoSocial?.trim() || null,
        cpfCnpj: this.formatClienteDoc(cliente.cpfCnpj),
      },
    };
  }

  private resolveOperadorNome(
    tipo: TipoCliente,
    cliente: {
      razaoSocial: string | null;
    } | null,
    pessoaAutorizada?: PessoaAutorizadaSession,
  ): string {
    const pessoaNome = pessoaAutorizada?.nome?.trim();
    if (pessoaNome) return pessoaNome;
    if (tipo === TipoCliente.PF && cliente?.razaoSocial) {
      return cliente.razaoSocial;
    }
    return '';
  }

  private async validatePortalRefresh(
    principalId: string,
    payload: PortalRefreshTokenPayload,
    req: Request | undefined,
  ): Promise<{ sid?: string; fp?: string }> {
    if (!payload.sid || payload.fp === undefined) return {};
    if (!req) {
      throw new UnauthorizedException('Requisição sem contexto para validação de sessão');
    }
    const ip = String(req.ip || req.socket?.remoteAddress || '');
    const ua = req.get('user-agent') || '';
    const hdr = this.device.extractHeaders(req);
    const fpNow = this.device.computeFingerprint(ip, ua, hdr);
    if (fpNow !== payload.fp) {
      throw new UnauthorizedException('Fingerprint não coincide com a sessão portal');
    }
    const ttl = parseDurationToSeconds(
      this.config.get<string>('PORTAL_JWT_REFRESH_EXPIRES_IN') ?? '7d',
    );
    const ok = await this.session.assertSessionValid(principalId, payload.sid, fpNow, ttl);
    if (!ok) throw new UnauthorizedException('Sessão portal inválida ou expirada');
    return { sid: payload.sid, fp: fpNow };
  }

  async login(
    documentoRaw: string,
    password: string,
    papel?: PortalPapel,
    tenantIdResolved?: string,
    req?: Request,
  ) {
    const p = (papel ?? 'CLIENTE') as PortalPapel;
    const loginTenantId = tenantIdResolved?.trim() || DEFAULT_TENANT_ID;
    if (p === 'CLIENTE') {
      const cpfCnpj = normalizeLoginDocumento(documentoRaw);
      const user = await this.prisma.user.findUnique({
        where: userWhereByDocumento(loginTenantId, cpfCnpj),
        include: { transportadoraAutorizada: true },
      });
      if (!user || !canPortalClienteLogin(user.role)) {
        await this.loginTelemetry.record({
          documento: cpfCnpj,
          sucesso: false,
          motivo: 'Credenciais inválidas para portal cliente',
          req,
        });
        throw new UnauthorizedException('Credenciais inválidas para portal cliente');
      }
      if (!user.clienteId?.trim()) {
        throw new UnauthorizedException(
          'Conta portal sem cadastro de cliente vinculado. Contate o suporte.',
        );
      }
      const ok = await bcrypt.compare(password, user.password);
      if (!ok) {
        await this.loginTelemetry.record({
          documento: cpfCnpj,
          userId: user.id,
          sucesso: false,
          motivo: 'Senha inválida portal cliente',
          req,
        });
        throw new UnauthorizedException('Credenciais inválidas para portal cliente');
      }

      const tenantId = user.tenantId;
      const sess = await this.registerPortalSession(user.id, req, 'portal');
      const access = this.portalJwt.signAccess({
        sub: user.id,
        email: user.email,
        cpfCnpj: user.cpfCnpj,
        portalPapel: 'CLIENTE',
        tenantId,
        clienteId: user.clienteId ?? null,
        tv: user.tokenVersion,
        ...(sess.sid ? { sid: sess.sid } : {}),
      });
      const refresh = this.portalJwt.signRefresh({
        sub: user.id,
        tv: user.tokenVersion,
        portalPapel: 'CLIENTE',
        tenantId,
        clienteId: user.clienteId ?? null,
        ...(sess.sid && sess.fp ? { sid: sess.sid, fp: sess.fp } : {}),
      });
      const clienteId = user.clienteId ?? null;
      const meta = await this.resolveClientePortalMeta(clienteId, user.cpfCnpj);
      if (!meta) {
        throw new UnauthorizedException(
          'Conta portal sem cadastro de cliente vinculado. Contate o suporte.',
        );
      }
      if (meta.statusCadastro === StatusCadastroCliente.REJEITADO) {
        throw new UnauthorizedException(
          'Cadastro rejeitado pela análise financeira. Contate o financeiro da RL Transportes.',
        );
      }
      const { tipo, cliente, statusCadastro, validacaoDominio, condicaoPagamento } = meta;

      let pessoaAutorizada: PessoaAutorizadaSession | undefined;
      let permissoesTransportadora: typeof TRANSPORTADORA_PERMISSOES_FIXAS | undefined;
      let skipSelectPessoa = false;
      const portalTenantRole = user.role;

      if (isTransportadoraTerceiraRole(user.role)) {
        const ta = user.transportadoraAutorizada;
        if (!ta?.ativo) {
          throw new UnauthorizedException('Transportadora autorizada inativa ou não encontrada.');
        }
        pessoaAutorizada = {
          id: ta.id,
          nome: ta.razaoSocial,
          email: ta.emailContato,
          telefone: null,
        };
        permissoesTransportadora = TRANSPORTADORA_PERMISSOES_FIXAS;
        skipSelectPessoa = true;
        if (sess.sid) {
          await this.session.setPessoaAutorizada(
            user.id,
            sess.sid,
            pessoaAutorizada,
            this.sessionTtlSeconds(),
            permissoesTransportadora,
          );
        }
      } else if (tipo === TipoCliente.PF && clienteId && sess.sid) {
        const cx: CxPortalRequestUser = {
          sub: user.id,
          email: user.email,
          cpfCnpj: user.cpfCnpj,
          portalPapel: 'CLIENTE',
          tenantId,
          clienteId,
          tokenVersion: user.tokenVersion,
          auth: 'portal',
          sid: sess.sid,
        };
        try {
          pessoaAutorizada = await this.pessoasAutorizadas.validarPessoaPorCpf(
            cx,
            user.cpfCnpj,
            req,
          );
        } catch (e) {
          this.logger.warn(
            `PF login: não foi possível vincular titular na sessão (${(e as Error).message})`,
          );
        }
      }

      await this.loginTelemetry.record({
        documento: cpfCnpj,
        userId: user.id,
        sucesso: true,
        req,
      });
      return {
        accessToken: access,
        refreshToken: refresh,
        tokenType: 'Bearer',
        portalIdentity: {
          sub: user.id,
          email: user.email,
          cpfCnpj: user.cpfCnpj,
          portalPapel: 'CLIENTE' as const,
          tenantId,
        },
        clienteId,
        portalPapel: 'CLIENTE',
        tenantId,
        tipo,
        cliente,
        statusCadastro,
        validacaoDominio,
        condicaoPagamento,
        usuario: {
          id: user.id,
          nome: this.resolveOperadorNome(tipo, cliente, pessoaAutorizada),
          tipo,
          email: user.email,
          cpfCnpj: user.cpfCnpj,
          onboardingConcluido: user.onboardingConcluido,
        },
        ...(pessoaAutorizada ? { pessoaAutorizada } : {}),
        portalTenantRole,
        skipSelectPessoa,
      };
    }

    const docDigits = documentoRaw.replace(/\D/g, '').slice(0, 14);

    const f = await this.fornecedores.validarSenha(documentoRaw, password);
    if (!f) {
      await this.loginTelemetry.record({
        documento: docDigits || 'unknown',
        sucesso: false,
        motivo: 'Credenciais inválidas para portal fornecedor',
        req,
      });
      throw new UnauthorizedException('Credenciais inválidas para portal fornecedor');
    }
    if (p !== 'FORNECEDOR' && p !== 'PARCEIRO') {
      throw new UnauthorizedException('Informe papel FORNECEDOR ou PARCEIRO');
    }
    if (f.papel !== p) {
      throw new UnauthorizedException('Papel não coincide com o cadastro CX');
    }

    const sess = await this.registerPortalSession(f.id, req, 'portal');
    const access = this.portalJwt.signAccess({
      sub: f.id,
      email: f.email,
      cpfCnpj: f.cpfCnpj,
      portalPapel: f.papel,
      tenantId: f.tenantId,
      clienteId: null,
      tv: f.tokenVersion,
      ...(sess.sid ? { sid: sess.sid } : {}),
    });
    const refresh = this.portalJwt.signRefresh({
      sub: f.id,
      tv: f.tokenVersion,
      portalPapel: f.papel,
      tenantId: f.tenantId,
      clienteId: null,
      ...(sess.sid && sess.fp ? { sid: sess.sid, fp: sess.fp } : {}),
    });
    await this.loginTelemetry.record({
      documento: docDigits || 'unknown',
      userId: f.id,
      sucesso: true,
      req,
    });
    return {
      accessToken: access,
      refreshToken: refresh,
      tokenType: 'Bearer',
      portalIdentity: {
        sub: f.id,
        email: f.email,
        cpfCnpj: f.cpfCnpj,
        portalPapel: f.papel,
        tenantId: f.tenantId,
      },
      clienteId: null,
      portalPapel: f.papel,
      tenantId: f.tenantId,
    };
  }

  async refresh(refreshToken: string, req?: Request) {
    let payload;
    try {
      payload = this.portalJwt.verifyRefresh(refreshToken);
    } catch {
      throw new UnauthorizedException('Refresh portal inválido');
    }
    if (payload.portalPapel === 'CLIENTE') {
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user || user.tokenVersion !== payload.tv) {
        throw new UnauthorizedException('Sessão portal revogada');
      }
      const vr = await this.validatePortalRefresh(user.id, payload, req);
      const tenantId = user.tenantId;
      const access = this.portalJwt.signAccess({
        sub: user.id,
        email: user.email,
        cpfCnpj: user.cpfCnpj,
        portalPapel: 'CLIENTE',
        tenantId,
        clienteId: user.clienteId ?? null,
        tv: user.tokenVersion,
        ...(vr.sid ? { sid: vr.sid } : {}),
      });
      const nextRefresh = this.portalJwt.signRefresh({
        sub: user.id,
        tv: user.tokenVersion,
        portalPapel: 'CLIENTE',
        tenantId,
        clienteId: user.clienteId ?? null,
        ...(vr.sid && vr.fp ? { sid: vr.sid, fp: vr.fp } : {}),
      });
      const clienteId = user.clienteId ?? null;
      const meta = await this.resolveClientePortalMeta(clienteId, user.cpfCnpj);
      return {
        accessToken: access,
        refreshToken: nextRefresh,
        tokenType: 'Bearer',
        portalIdentity: {
          sub: user.id,
          email: user.email,
          cpfCnpj: user.cpfCnpj,
          portalPapel: 'CLIENTE' as const,
          tenantId: payload.tenantId,
        },
        clienteId,
        portalPapel: 'CLIENTE',
        tenantId: payload.tenantId,
        ...(meta
          ? {
              tipo: meta.tipo,
              cliente: meta.cliente,
              statusCadastro: meta.statusCadastro,
              validacaoDominio: meta.validacaoDominio,
              condicaoPagamento: meta.condicaoPagamento,
              usuario: {
                id: user.id,
                nome: this.resolveOperadorNome(meta.tipo, meta.cliente),
                tipo: meta.tipo,
                email: user.email,
                cpfCnpj: user.cpfCnpj,
                onboardingConcluido: user.onboardingConcluido,
              },
            }
          : {}),
      };
    }

    const f = await this.fornecedores.obterPorId(payload.sub);
    if (!f || f.tokenVersion !== payload.tv) {
      throw new UnauthorizedException('Sessão portal revogada');
    }
    const vr = await this.validatePortalRefresh(f.id, payload, req);
    const access = this.portalJwt.signAccess({
      sub: f.id,
      email: f.email,
      cpfCnpj: f.cpfCnpj,
      portalPapel: f.papel,
      tenantId: f.tenantId,
      clienteId: null,
      tv: f.tokenVersion,
      ...(vr.sid ? { sid: vr.sid } : {}),
    });
    const nextRefresh = this.portalJwt.signRefresh({
      sub: f.id,
      tv: f.tokenVersion,
      portalPapel: f.papel,
      tenantId: f.tenantId,
      clienteId: null,
      ...(vr.sid && vr.fp ? { sid: vr.sid, fp: vr.fp } : {}),
    });
    return {
      accessToken: access,
      refreshToken: nextRefresh,
      tokenType: 'Bearer',
      portalIdentity: {
        sub: f.id,
        email: f.email,
        cpfCnpj: f.cpfCnpj,
        portalPapel: f.papel,
        tenantId: f.tenantId,
      },
      clienteId: null,
    };
  }

  twoFaStub(body: { code?: string }) {
    if (body.code === '000000') {
      throw new ConflictException('Código 2FA inválido (simulado)');
    }
    return {
      enabled: false,
      message: '2FA opcional — não habilitado nesta fase.',
    };
  }

  /** Marca product tour do portal como concluído (não exibir novamente). */
  async concluirOnboarding(userId: string): Promise<{ ok: true; onboardingConcluido: true }> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { onboardingConcluido: true },
    });
    return { ok: true, onboardingConcluido: true };
  }

  /** Snapshot de sessão portal (GET /portal/me) — compatível com resposta de login. */
  async buildSessionView(cx: CxPortalRequestUser) {
    if (cx.portalPapel === 'CLIENTE') {
      const user = await this.prisma.user.findUnique({ where: { id: cx.sub } });
      if (!user) throw new UnauthorizedException('Usuário não encontrado');
      const clienteId = cx.clienteId ?? user.clienteId ?? null;
      const meta = await this.resolveClientePortalMeta(clienteId, user.cpfCnpj);
      if (!meta) {
        throw new UnauthorizedException('Conta portal sem cadastro de cliente vinculado.');
      }
      return {
        portalIdentity: {
          sub: user.id,
          email: user.email,
          cpfCnpj: user.cpfCnpj,
          portalPapel: 'CLIENTE' as const,
          tenantId: cx.tenantId,
        },
        clienteId,
        portalPapel: 'CLIENTE' as const,
        tenantId: cx.tenantId,
        tipo: meta.tipo,
        cliente: meta.cliente,
        statusCadastro: meta.statusCadastro,
        validacaoDominio: meta.validacaoDominio,
        condicaoPagamento: meta.condicaoPagamento,
        usuario: {
          id: user.id,
          nome: this.resolveOperadorNome(meta.tipo, meta.cliente, cx.pessoaAutorizada),
          tipo: meta.tipo,
          email: user.email,
          cpfCnpj: user.cpfCnpj,
          onboardingConcluido: user.onboardingConcluido,
        },
      };
    }
    const f = await this.fornecedores.obterPorId(cx.sub);
    if (!f) throw new UnauthorizedException('Fornecedor não encontrado');
    return {
      portalIdentity: {
        sub: f.id,
        email: f.email,
        cpfCnpj: f.cpfCnpj,
        portalPapel: f.papel,
        tenantId: f.tenantId,
      },
      clienteId: null,
      portalPapel: f.papel,
      tenantId: f.tenantId,
    };
  }
}
