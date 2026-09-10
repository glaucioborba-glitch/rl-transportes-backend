import type { EmpresaLogoMeta, EmpresaLogoSlot } from './empresa-logo.util';

export type EmpresaRegimeTributario = 'SIMPLES_NACIONAL' | 'LUCRO_PRESUMIDO' | 'LUCRO_REAL';

export type EmpresaOperadoraDados = {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  inscricaoEstadual: string;
  inscricaoMunicipal: string;
  cnae: string;
  telefone: string;
  email: string;
  emailNf: string;
  emailFinanceiro: string;
  site: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  regimeTributario: EmpresaRegimeTributario;
  simplesAnexo: string;
  aliquotaIss: number;
  aliquotaPis: number;
  aliquotaCofins: number;
  aliquotaCsll: number;
  aliquotaIrpj: number;
  logos: Partial<Record<EmpresaLogoSlot, EmpresaLogoMeta>>;
};

export const DEFAULT_EMPRESA_OPERADORA: EmpresaOperadoraDados = {
  razaoSocial: '',
  nomeFantasia: '',
  cnpj: '',
  inscricaoEstadual: '',
  inscricaoMunicipal: '',
  cnae: '',
  telefone: '',
  email: '',
  emailNf: '',
  emailFinanceiro: '',
  site: '',
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  uf: '',
  regimeTributario: 'SIMPLES_NACIONAL',
  simplesAnexo: '',
  aliquotaIss: 2,
  aliquotaPis: 0.65,
  aliquotaCofins: 3,
  aliquotaCsll: 9,
  aliquotaIrpj: 15,
  logos: {},
};

export function mergeEmpresaOperadora(
  raw: unknown,
  fallbackNome = '',
): EmpresaOperadoraDados {
  const r = raw && typeof raw === 'object' ? (raw as Partial<EmpresaOperadoraDados>) : {};
  const nome = (r.razaoSocial ?? r.nomeFantasia ?? fallbackNome).trim();
  return {
    ...DEFAULT_EMPRESA_OPERADORA,
    ...r,
    razaoSocial: (r.razaoSocial ?? '').trim() || nome,
    nomeFantasia: (r.nomeFantasia ?? '').trim() || nome,
    cnpj: String(r.cnpj ?? '').replace(/\D/g, '').slice(0, 14),
    logos: r.logos && typeof r.logos === 'object' ? { ...r.logos } : {},
    aliquotaIss: num(r.aliquotaIss, DEFAULT_EMPRESA_OPERADORA.aliquotaIss),
    aliquotaPis: num(r.aliquotaPis, DEFAULT_EMPRESA_OPERADORA.aliquotaPis),
    aliquotaCofins: num(r.aliquotaCofins, DEFAULT_EMPRESA_OPERADORA.aliquotaCofins),
    aliquotaCsll: num(r.aliquotaCsll, DEFAULT_EMPRESA_OPERADORA.aliquotaCsll),
    aliquotaIrpj: num(r.aliquotaIrpj, DEFAULT_EMPRESA_OPERADORA.aliquotaIrpj),
    regimeTributario: parseRegime(r.regimeTributario),
  };
}

function num(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function parseRegime(v: unknown): EmpresaRegimeTributario {
  if (v === 'LUCRO_PRESUMIDO' || v === 'LUCRO_REAL' || v === 'SIMPLES_NACIONAL') return v;
  return 'SIMPLES_NACIONAL';
}
