import { TipoNotificacaoPortal } from '@prisma/client';

const FORMA_LABEL: Record<string, string> = {
  AVISTA_PIX: 'PIX à vista',
  FATURAMENTO: 'faturamento',
  PIX: 'PIX à vista',
  FATURAMENTO_PIX: 'faturamento / PIX à vista',
};

const PRAZO_LABEL: Record<string, string> = {
  A_VISTA: 'à vista',
  '30_DIAS': '30 dias',
  '30_60': '30/60 dias',
  '30_60_90': '30/60/90 dias',
  PERSONALIZADO: 'personalizado',
};

export function labelFormaNotificacao(value: string | null | undefined): string {
  const t = value?.trim();
  if (!t) return 'a definir';
  return FORMA_LABEL[t] ?? t.replace(/_/g, ' ').toLowerCase();
}

export function labelPrazoNotificacao(value: string | null | undefined): string {
  const t = value?.trim();
  if (!t) return 'a definir';
  return PRAZO_LABEL[t] ?? t.replace(/_/g, ' ').toLowerCase();
}

export type MensagemPortalNotificacao = {
  tipo: TipoNotificacaoPortal;
  titulo: string;
  corpo: string;
  link: string;
};

const FECHO = 'Permanecemos à disposição.';

export function mensagemCadastroEmAnalise(): MensagemPortalNotificacao {
  return {
    tipo: TipoNotificacaoPortal.CADASTRO_EM_ANALISE,
    titulo: 'Cadastro em análise financeira',
    corpo: [
      'Prezado cliente,',
      '',
      'Confirmamos o recebimento do seu cadastro. Nossa área financeira concluirá a análise em até 48 horas.',
      '',
      'Enquanto o processo não for finalizado, a condição vigente para novas solicitações é pagamento à vista, via PIX, com quitação antes da coleta.',
      '',
      FECHO,
    ].join('\n'),
    link: '/portal/financeiro',
  };
}

export function mensagemCadastroAprovado(
  forma: string | null | undefined,
  prazo: string | null | undefined,
): MensagemPortalNotificacao {
  const formaL = labelFormaNotificacao(forma);
  const prazoL = labelPrazoNotificacao(prazo);
  return {
    tipo: TipoNotificacaoPortal.CADASTRO_APROVADO,
    titulo: 'Condição comercial aprovada',
    corpo: [
      'Prezado cliente,',
      '',
      'Informamos que a análise financeira do seu cadastro foi concluída.',
      '',
      `A condição comercial aprovada é: forma de pagamento ${formaL} e prazo ${prazoL}.`,
      '',
      'Essas informações já estão disponíveis na área Financeiro do portal.',
      '',
      FECHO,
    ].join('\n'),
    link: '/portal/financeiro',
  };
}

export function mensagemCadastroRejeitado(motivo: string): MensagemPortalNotificacao {
  const motivoLimpo = motivo.trim() || 'não informado';
  return {
    tipo: TipoNotificacaoPortal.CADASTRO_REJEITADO,
    titulo: 'Cadastro não aprovado',
    corpo: [
      'Prezado cliente,',
      '',
      'Após análise financeira, não foi possível aprovar o cadastro neste momento.',
      '',
      `Motivo informado: ${motivoLimpo}`,
      '',
      'Para esclarecimentos ou regularização, entre em contato com o financeiro da RL Transportes.',
      '',
      FECHO,
    ].join('\n'),
    link: '/portal/perfil',
  };
}

export function mensagemCondicaoAlterada(
  forma: string | null | undefined,
  prazo: string | null | undefined,
): MensagemPortalNotificacao {
  const formaL = labelFormaNotificacao(forma);
  const prazoL = labelPrazoNotificacao(prazo);
  return {
    tipo: TipoNotificacaoPortal.CONDICAO_PAGAMENTO_ALTERADA,
    titulo: 'Atualização da condição de pagamento',
    corpo: [
      'Prezado cliente,',
      '',
      'Informamos que a condição comercial da sua conta foi atualizada.',
      '',
      `A forma de pagamento vigente passa a ser ${formaL}, com prazo ${prazoL}.`,
      '',
      'Consulte os detalhes na área Financeiro do portal.',
      '',
      FECHO,
    ].join('\n'),
    link: '/portal/financeiro',
  };
}

export function mensagemUnidadeProcessoAberto(numero: number, unidadeIso: string): MensagemPortalNotificacao {
  return {
    tipo: TipoNotificacaoPortal.UNIDADE_PROCESSO_ABERTO,
    titulo: `ID ${numero} aberto`,
    corpo: [
      'Prezado cliente,',
      '',
      `A unidade ${unidadeIso} entrou em estoque com o ${`ID ${numero}`}.`,
      '',
      'O faturamento de armazenagem acompanha este ID até a saída.',
      '',
      FECHO,
    ].join('\n'),
    link: '/portal/patio',
  };
}

export function mensagemUnidadeProcessoEncerrado(numero: number, unidadeIso: string): MensagemPortalNotificacao {
  return {
    tipo: TipoNotificacaoPortal.UNIDADE_PROCESSO_ENCERRADO,
    titulo: `ID ${numero} encerrado`,
    corpo: [
      'Prezado cliente,',
      '',
      `A unidade ${unidadeIso} saiu do pátio. O ${`ID ${numero}`} foi encerrado e a cobrança deste ciclo será consolidada.`,
      '',
      FECHO,
    ].join('\n'),
    link: '/portal/financeiro',
  };
}
