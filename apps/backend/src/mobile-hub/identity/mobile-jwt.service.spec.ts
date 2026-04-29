import { Test } from '@nestjs/testing';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MobileJwtService } from './mobile-jwt.service';

describe('MobileJwtService', () => {
  it('signAccess e verifyAccess preservam payload mobile', async () => {
    const cfg = {
      get: (k: string) =>
        ({
          MOBILE_JWT_SECRET: 'mobile-unit-secret',
          MOBILE_JWT_REFRESH_SECRET: 'mobile-refresh-secret',
          MOBILE_JWT_EXPIRES_IN: '15m',
          MOBILE_JWT_REFRESH_EXPIRES_IN: '7d',
        })[k],
      getOrThrow: () => {
        throw new Error('unused');
      },
    } as unknown as ConfigService;

    const mod = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'unused-default', signOptions: { expiresIn: '1h' } })],
      providers: [
        MobileJwtService,
        {
          provide: ConfigService,
          useValue: cfg,
        },
      ],
    }).compile();

    const svc = mod.get(MobileJwtService);
    const tok = svc.signAccess({
      sub: 'u1',
      email: 'a@a.com',
      mobileRole: 'OPERADOR_MOBILE',
      deviceId: 'dev-1',
      tv: 0,
      clienteId: null,
    });
    const pl = svc.verifyAccess(tok);
    expect(pl.kind).toBe('mobile_access');
    expect(pl.mobileRole).toBe('OPERADOR_MOBILE');
    expect(pl.deviceId).toBe('dev-1');
  });
});
