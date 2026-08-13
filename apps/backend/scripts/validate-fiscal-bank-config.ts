#!/usr/bin/env npx ts-node
/**
 * Valida configuração H9 (IPM + bancário) sem transmitir documentos reais.
 * Uso: cd apps/backend && npx ts-node scripts/validate-fiscal-bank-config.ts
 */
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

type Check = { ok: boolean; label: string; hint?: string };

function env(key: string): string {
  return (process.env[key] ?? '').trim();
}

function checkFile(pathRaw: string, pass?: string): Check {
  if (!pathRaw) {
    return { ok: false, label: 'Certificado A1', hint: 'Defina NFSE_IPM_CERT_PATH' };
  }
  const path = resolve(pathRaw);
  if (!existsSync(path)) {
    return { ok: false, label: 'Certificado A1', hint: `Arquivo não encontrado: ${path}` };
  }
  try {
    readFileSync(path);
  } catch {
    return { ok: false, label: 'Certificado A1', hint: `Sem permissão de leitura: ${path}` };
  }
  if (!pass) {
    return { ok: true, label: 'Certificado A1', hint: `${path} (NFSE_IPM_CERT_PASS vazio — confirme se o PFX não exige senha)` };
  }
  return { ok: true, label: 'Certificado A1', hint: path };
}

function main(): void {
  const checks: Check[] = [];
  const senhaIpm = env('NFSE_IPM_SENHA');
  const certPath = env('NFSE_IPM_CERT_PATH');
  const certPass = env('NFSE_IPM_CERT_PASS');
  const bankProvider = env('BANK_PROVIDER') || 'sandbox';
  const bankBase = env('BANK_API_BASE_URL');
  const bankId = env('BANK_CLIENT_ID');
  const bankSecret = env('BANK_CLIENT_SECRET');

  checks.push({
    ok: !!senhaIpm,
    label: 'IPM — senha portal',
    hint: senhaIpm ? 'NFSE_IPM_SENHA definida' : 'Obrigatória para emissão real (sandbox se omitida)',
  });

  if (senhaIpm) {
    checks.push(checkFile(certPath, certPass));
    checks.push({
      ok: !!env('NFSE_IPM_PRESTADOR_CNPJ'),
      label: 'IPM — CNPJ prestador',
    });
    checks.push({
      ok: !!env('NFSE_ARM_CODIGO_ITEM') || !!env('NFSE_ARM_CODIGO_SERVICO'),
      label: 'IPM — código serviço armazenagem',
      hint: 'NFSE_ARM_CODIGO_ITEM ou NFSE_ARM_CODIGO_SERVICO',
    });
  }

  const bankReal = bankProvider !== 'sandbox';
  checks.push({
    ok: !bankReal || (!!bankBase && !!bankId && !!bankSecret),
    label: `Banco — ${bankProvider}`,
    hint: bankReal
      ? 'BANK_API_BASE_URL, BANK_CLIENT_ID e BANK_CLIENT_SECRET obrigatórios'
      : 'Modo sandbox (links mock no portal)',
  });

  const mode =
    senhaIpm && certPath && bankReal ? 'PRODUÇÃO/HOMOLOG' : senhaIpm ? 'FISCAL REAL + BANCO SANDBOX' : 'SANDBOX DEV';

  console.log('\n=== RL Transportes — Validação H9 (Fiscal + Bancário) ===\n');
  console.log(`Modo inferido: ${mode}\n`);

  for (const c of checks) {
    const icon = c.ok ? '✓' : '✗';
    console.log(`${icon} ${c.label}${c.hint ? ` — ${c.hint}` : ''}`);
  }

  const failed = checks.filter((c) => !c.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} checks OK`);

  if (failed.length && senhaIpm) {
    console.log('\nCorrija os itens marcados com ✗ antes de homologar em staging/prod.');
    process.exitCode = 1;
  } else {
    console.log('\nPronto para dev (sandbox) ou revise checklist em docs/HOMOLOGACAO-FISCAL-BANCARIO-H9.md');
  }
}

main();
