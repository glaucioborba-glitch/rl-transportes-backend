import { Injectable } from '@nestjs/common';
import { CxPortalAuthGuard } from './cx-portal-auth.guard';

/**
 * Guard semântico para rotas do portal (JWT portal / corporativo cliente).
 * Delega em `CxPortalAuthGuard` — validação de Bearer e payload portal.
 */
@Injectable()
export class JwtPortalAuthGuard extends CxPortalAuthGuard {}
