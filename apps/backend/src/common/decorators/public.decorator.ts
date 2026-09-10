import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Rota sem JWT staff (login, health de LB, CEP, webhooks, mídia assinada). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
