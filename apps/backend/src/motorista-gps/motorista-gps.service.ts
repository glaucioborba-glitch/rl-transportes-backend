import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { MotoristaGpsOrigem } from '@prisma/client';
import { maskCpfDisplay, onlyDigits } from '../common/utils/br-documents';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_TENANT_ID } from '../tenant/tenant.constants';
import { TenantContextService } from '../tenant/tenant-context.service';
import type { MotoristaGpsJwtPayload } from './motorista-gps.types';
import { GoogleRoutesService } from './google-routes.service';
import { escolherDestinoMapa } from './destino-mapa.util';
import {
  MOTORISTA_GPS_JWT_TYP,
  assertLatLng,
  motoristaGpsEstaOnline,
  pinLocalizacaoConfere,
  rotuloOrigemGps,
  type MotoristaGpsIdentidade,
} from './motorista-gps.util';

const JWT_EXPIRES = '12h';

/** Lista motoristas + destinos cadastrados; ETA usa o destino escolhido na tela. */
export type MotoristaGpsMapaItem = {
  origem: MotoristaGpsOrigem;
  cadastroId: string;
  nome: string;
  cpfMascara: string;
  placaCavalo: string | null;
  tipo: string;
  lat: number | null;
  lng: number | null;
  precisaoM: number | null;
  rastreando: boolean;
  online: boolean;
  atualizadoEm: string | null;
  etaMinutos?: number | null;
  etaAt?: string | null;
  distanciaM?: number | null;
  rotaPolyline?: string | null;
};

export type MotoristaGpsDestinoMapa = {
  id: string;
  codigo: string;
  nome: string;
  tipo: string;
  cidade: string | null;
  uf: string | null;
  lat: number | null;
  lng: number | null;
};

export type MotoristaGpsMapaPayload = {
  destinoId: string | null;
  destinos: MotoristaGpsDestinoMapa[];
  items: MotoristaGpsMapaItem[];
};

@Injectable()
export class MotoristaGpsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly tenantContext: TenantContextService,
    private readonly routes: GoogleRoutesService,
  ) {}

  private tenantId(): string {
    return this.tenantContext.getTenantId()?.trim() || DEFAULT_TENANT_ID;
  }

  private jwtSecret(): string {
    return this.config.get<string>('secrets.jwtSecret') ?? this.config.getOrThrow<string>('JWT_SECRET');
  }

  async login(cpfRaw: string, pin: string) {
    const cpf = onlyDigits(cpfRaw);
    if (cpf.length !== 11) {
      throw new UnauthorizedException('CPF ou PIN inválidos');
    }
    if (!pinLocalizacaoConfere(cpf, pin)) {
      throw new UnauthorizedException('CPF ou PIN inválidos');
    }
    const ident = await this.resolverIdentidade(this.tenantId(), cpf);
    if (!ident) {
      throw new UnauthorizedException('Motorista não encontrado no cadastro da RL');
    }
    const payload: MotoristaGpsJwtPayload = {
      typ: MOTORISTA_GPS_JWT_TYP,
      sub: ident.cadastroId,
      origem: ident.origem,
      cpf: ident.cpf,
      tenantId: this.tenantId(),
    };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.jwtSecret(),
      expiresIn: JWT_EXPIRES,
    });
    return {
      accessToken,
      motorista: {
        origem: ident.origem,
        tipo: rotuloOrigemGps(ident.origem),
        nome: ident.nome,
        placaCavalo: ident.placaCavalo,
      },
    };
  }

  async ping(payload: MotoristaGpsJwtPayload, lat: number, lng: number, precisaoM?: number) {
    const ident = await this.identidadeDoToken(payload);
    const coords = assertLatLng(lat, lng);
    const now = new Date();
    await this.prisma.motoristaPosicao.upsert({
      where: {
        tenantId_origem_cadastroId: {
          tenantId: payload.tenantId,
          origem: ident.origem,
          cadastroId: ident.cadastroId,
        },
      },
      create: {
        tenantId: payload.tenantId,
        origem: ident.origem,
        cadastroId: ident.cadastroId,
        cpf: ident.cpf,
        nome: ident.nome,
        placaCavalo: ident.placaCavalo,
        lat: coords.lat,
        lng: coords.lng,
        precisaoM: precisaoM ?? null,
        rastreando: true,
        atualizadoEm: now,
      },
      update: {
        cpf: ident.cpf,
        nome: ident.nome,
        placaCavalo: ident.placaCavalo,
        lat: coords.lat,
        lng: coords.lng,
        precisaoM: precisaoM ?? null,
        rastreando: true,
        atualizadoEm: now,
      },
    });
    return { ok: true as const, atualizadoEm: now.toISOString() };
  }

  async parar(payload: MotoristaGpsJwtPayload) {
    const ident = await this.identidadeDoToken(payload);
    await this.prisma.motoristaPosicao.updateMany({
      where: {
        tenantId: payload.tenantId,
        origem: ident.origem,
        cadastroId: ident.cadastroId,
      },
      data: { rastreando: false },
    });
    return { ok: true as const };
  }

  async me(payload: MotoristaGpsJwtPayload) {
    const ident = await this.identidadeDoToken(payload);
    return {
      origem: ident.origem,
      tipo: rotuloOrigemGps(ident.origem),
      nome: ident.nome,
      placaCavalo: ident.placaCavalo,
    };
  }

  async listarMapa(destinoId?: string): Promise<MotoristaGpsMapaPayload> {
    const tenantId = this.tenantId();
    const [internos, terceiros, posicoes, locais] = await Promise.all([
      this.prisma.cadastroMotorista.findMany({
        where: { tenantId, deletedAt: null, ativo: true },
        select: { id: true, nome: true, cpf: true, placaCavalo: true },
        orderBy: { nome: 'asc' },
      }),
      this.prisma.cadastroTerceiro.findMany({
        where: { tenantId, deletedAt: null, ativo: true },
        select: {
          id: true,
          motoristaNome: true,
          motoristaCpf: true,
          placaCavalo: true,
        },
        orderBy: { motoristaNome: 'asc' },
      }),
      this.prisma.motoristaPosicao.findMany({
        where: { tenantId },
      }),
      this.prisma.cadastroLocalTransporte.findMany({
        where: { tenantId, deletedAt: null, ativo: true },
        select: {
          id: true,
          codigo: true,
          nome: true,
          tipo: true,
          cidade: true,
          uf: true,
          lat: true,
          lng: true,
        },
        orderBy: { nome: 'asc' },
      }),
    ]);

    const posByKey = new Map(
      posicoes.map((p) => [`${p.origem}:${p.cadastroId}`, p]),
    );

    const items: MotoristaGpsMapaItem[] = [];
    for (const row of internos) {
      items.push(
        this.toMapaItem(
          MotoristaGpsOrigem.INTERNO,
          row.id,
          row.nome,
          row.cpf,
          row.placaCavalo,
          posByKey.get(`${MotoristaGpsOrigem.INTERNO}:${row.id}`),
        ),
      );
    }
    for (const row of terceiros) {
      items.push(
        this.toMapaItem(
          MotoristaGpsOrigem.TERCEIRO,
          row.id,
          row.motoristaNome,
          row.motoristaCpf,
          row.placaCavalo,
          posByKey.get(`${MotoristaGpsOrigem.TERCEIRO}:${row.id}`),
        ),
      );
    }
    items.sort((a, b) => Number(b.online) - Number(a.online) || a.nome.localeCompare(b.nome, 'pt-BR'));
    const destinos: MotoristaGpsDestinoMapa[] = locais.map((l) => ({
      id: l.id,
      codigo: l.codigo,
      nome: l.nome,
      tipo: l.tipo,
      cidade: l.cidade,
      uf: l.uf,
      lat: l.lat,
      lng: l.lng,
    }));
    const escolhido = escolherDestinoMapa(destinos, destinoId);
    const rota = escolhido?.lat != null && escolhido.lng != null
      ? { kind: 'latLng' as const, lat: escolhido.lat, lng: escolhido.lng }
      : undefined;
    await this.routes.enriquecerComEta(items, rota);
    return {
      destinoId: escolhido?.id ?? null,
      destinos,
      items,
    };
  }

  private toMapaItem(
    origem: MotoristaGpsOrigem,
    cadastroId: string,
    nome: string,
    cpf: string,
    placaCavalo: string | null,
    pos?: {
      lat: number;
      lng: number;
      precisaoM: number | null;
      rastreando: boolean;
      atualizadoEm: Date;
    },
  ): MotoristaGpsMapaItem {
    return {
      origem,
      cadastroId,
      nome,
      cpfMascara: maskCpfDisplay(cpf),
      placaCavalo,
      tipo: rotuloOrigemGps(origem),
      lat: pos?.lat ?? null,
      lng: pos?.lng ?? null,
      precisaoM: pos?.precisaoM ?? null,
      rastreando: pos?.rastreando ?? false,
      online: motoristaGpsEstaOnline(pos?.atualizadoEm, pos?.rastreando ?? false),
      atualizadoEm: pos?.atualizadoEm?.toISOString() ?? null,
    };
  }

  private async identidadeDoToken(payload: MotoristaGpsJwtPayload): Promise<MotoristaGpsIdentidade> {
    const ident = await this.resolverPorCadastro(payload.tenantId, payload.origem, payload.sub);
    if (!ident || ident.cpf !== payload.cpf) {
      throw new UnauthorizedException('Cadastro inativo ou removido');
    }
    return ident;
  }

  private async resolverIdentidade(tenantId: string, cpf: string): Promise<MotoristaGpsIdentidade | null> {
    const interno = await this.prisma.cadastroMotorista.findFirst({
      where: { tenantId, cpf, deletedAt: null, ativo: true },
      select: { id: true, nome: true, cpf: true, placaCavalo: true },
    });
    if (interno) {
      return {
        origem: MotoristaGpsOrigem.INTERNO,
        cadastroId: interno.id,
        cpf: interno.cpf,
        nome: interno.nome,
        placaCavalo: interno.placaCavalo,
      };
    }
    const terceiro = await this.prisma.cadastroTerceiro.findFirst({
      where: { tenantId, motoristaCpf: cpf, deletedAt: null, ativo: true },
      select: { id: true, motoristaNome: true, motoristaCpf: true, placaCavalo: true },
    });
    if (!terceiro) return null;
    return {
      origem: MotoristaGpsOrigem.TERCEIRO,
      cadastroId: terceiro.id,
      cpf: terceiro.motoristaCpf,
      nome: terceiro.motoristaNome,
      placaCavalo: terceiro.placaCavalo,
    };
  }

  private async resolverPorCadastro(
    tenantId: string,
    origem: MotoristaGpsOrigem,
    cadastroId: string,
  ): Promise<MotoristaGpsIdentidade | null> {
    if (origem === MotoristaGpsOrigem.INTERNO) {
      const row = await this.prisma.cadastroMotorista.findFirst({
        where: { id: cadastroId, tenantId, deletedAt: null, ativo: true },
        select: { id: true, nome: true, cpf: true, placaCavalo: true },
      });
      if (!row) return null;
      return {
        origem,
        cadastroId: row.id,
        cpf: row.cpf,
        nome: row.nome,
        placaCavalo: row.placaCavalo,
      };
    }
    const row = await this.prisma.cadastroTerceiro.findFirst({
      where: { id: cadastroId, tenantId, deletedAt: null, ativo: true },
      select: { id: true, motoristaNome: true, motoristaCpf: true, placaCavalo: true },
    });
    if (!row) return null;
    return {
      origem,
      cadastroId: row.id,
      cpf: row.motoristaCpf,
      nome: row.motoristaNome,
      placaCavalo: row.placaCavalo,
    };
  }
}

export function mapGpsCoordError(e: unknown): never {
  if (e instanceof Error && /Coordenada/.test(e.message)) {
    throw new BadRequestException(e.message);
  }
  throw e;
}
