import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import type { StringValue } from 'ms';
import type { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { permissionsForRole } from '../common/constants/role-permissions';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import type { JwtPayload } from './strategies/jwt.strategy';
import { CreateUserDto } from './dto/create-user.dto';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) return null;
    const ok = await bcrypt.compare(password, user.password);
    return ok ? user : null;
  }

  async login(email: string, password: string) {
    const normalized = email.toLowerCase();
    const key = `login_attempt:${normalized}`;

    const attempts = await this.redisService.incr(key);
    if (attempts === 1) {
      await this.redisService.expire(key, 60);
    }
    if (attempts > 5) {
      throw new HttpException(
        'Muitas tentativas de login. Tente novamente mais tarde.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = await this.validateUser(email, password);
    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    await this.redisService.del(key);
    return this.issueTokens(user);
  }

  async refresh(refreshToken: string) {
    const secret =
      this.configService.get<string>('secrets.jwtRefreshSecret') ??
      this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(refreshToken, { secret });
    } catch {
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado');
    }
    return this.issueTokens(user);
  }

  issueTokens(user: User) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    const accessExpires = this.configService.get<string>('JWT_EXPIRES_IN') ?? '1h';
    const refreshExpires = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';
    const refreshSecret =
      this.configService.get<string>('secrets.jwtRefreshSecret') ??
      this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');

    const accessOpts: JwtSignOptions = { expiresIn: accessExpires as StringValue };
    const refreshOpts: JwtSignOptions = {
      secret: refreshSecret,
      expiresIn: refreshExpires as StringValue,
    };

    return {
      accessToken: this.jwtService.sign(payload, accessOpts),
      refreshToken: this.jwtService.sign(payload, refreshOpts),
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        permissions: permissionsForRole(user.role),
        createdAt: user.createdAt,
      },
    };
  }

  async createUser(dto: CreateUserDto) {
    const email = dto.email.toLowerCase();
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) {
      throw new ConflictException('E-mail já cadastrado');
    }
    const password = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        email,
        password,
        role: dto.role,
      },
    });
    const { password: _p, ...safe } = user;
    return safe;
  }
}
