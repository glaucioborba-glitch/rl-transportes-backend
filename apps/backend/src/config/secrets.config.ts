import { registerAs } from '@nestjs/config';

/**
 * Centraliza leitura de segredos a partir de variáveis de ambiente.
 * Em produção, substituir a origem por AWS Secrets Manager / Azure Key Vault / Vault.
 */
export default registerAs('secrets', () => ({
  jwtSecret: process.env.JWT_SECRET,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  databaseUrl: process.env.DATABASE_URL,
}));
