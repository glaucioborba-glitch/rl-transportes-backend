-- Product tour portal: flag por usuário (User).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboarding_concluido" BOOLEAN NOT NULL DEFAULT false;
