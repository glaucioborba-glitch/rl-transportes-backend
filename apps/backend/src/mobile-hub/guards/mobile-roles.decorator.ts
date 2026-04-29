import { SetMetadata } from '@nestjs/common';
import type { MobileRole } from '../types/mobile-hub.types';

export const MOBILE_ROLES_KEY = 'mobile_hub_roles';

export const MobileRoles = (...roles: MobileRole[]) => SetMetadata(MOBILE_ROLES_KEY, roles);

export const MOBILE_CRITICAL_KEY = 'mobile_hub_critical';
export const MobileCriticalRoute = () => SetMetadata(MOBILE_CRITICAL_KEY, true);
