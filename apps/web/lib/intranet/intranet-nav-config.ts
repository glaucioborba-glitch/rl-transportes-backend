"use client";

import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDownCircle,
  ArrowLeftRight,
  ArrowUpCircle,
  Award,
  Bell,
  BookOpen,
  Boxes,
  Briefcase,
  Building,
  Building2,
  Calculator,
  Calendar,
  CalendarClock,
  CheckCircle,
  Clock,
  Container,
  CreditCard,
  DollarSign,
  Eye,
  FileCheck,
  FileSearch,
  FileText,
  Fingerprint,
  FolderOpen,
  GitBranch,
  Grid3x3,
  History,
  LayoutDashboard,
  Radio,
  Repeat,
  Scale,
  Search,
  Send,
  Settings,
  Shield,
  ShieldCheck,
  Ship,
  Target,
  Timer,
  TrendingUp,
  Truck,
  UserPlus,
  Users,
  Wallet,
  MapPin,
} from "lucide-react";

export type IntranetModuleId =
  | "dashboard"
  | "portaria"
  | "gate"
  | "cadastros"
  | "dispatch"
  | "patio"
  | "financeiro"
  | "rh"
  | "admin"
  | "cockpit"
  | "bi"
  | "grc"
  | "ssma"
  | "auditoria";

export type IntranetNavItem = {
  id: IntranetModuleId;
  label: string;
  href: string;
  roles?: string[];
  /** Só o submenu Fretes: planilha em outra aba. */
  openInNewTab?: boolean;
};

export type IntranetSubMenuItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  badgeKey?: string;
  description?: string;
  roles?: string[];
  openInNewTab?: boolean;
};

export type IntranetAdvancedItem = {
  label: string;
  href: string;
};

export type IntranetAdvancedGroup = {
  label: string;
  items: IntranetAdvancedItem[];
};

/** Menu master horizontal — URLs reais (route groups não aparecem na URL). */
export const MODULOS_INTRANET: IntranetNavItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/operador/dashboard",
    roles: ["ADMIN", "GERENTE", "OPERADOR_PORTARIA", "OPERADOR_GATE", "OPERADOR_PATIO"],
  },
  {
    id: "portaria",
    label: "Portaria",
    href: "/operador/portaria",
    roles: ["ADMIN", "GERENTE", "OPERADOR_GATE", "OPERADOR_PORTARIA"],
  },
  {
    id: "gate",
    label: "Gate CPO",
    href: "/operador/gate/controle-entrada-saida",
    roles: ["ADMIN", "GERENTE", "OPERADOR_GATE"],
  },
  {
    id: "cadastros",
    label: "Cadastros",
    href: "/cadastros",
    roles: ["ADMIN", "GERENTE", "FINANCEIRO", "RH"],
  },
  {
    id: "dispatch",
    label: "Transportes",
    href: "/operador/transportes",
    roles: ["ADMIN", "GERENTE", "OPERADOR_GATE"],
  },
  {
    id: "patio",
    label: "Pátio",
    href: "/operador/patio",
    roles: ["OPERADOR_PATIO"],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    href: "/financeiro",
    roles: ["ADMIN", "GERENTE"],
  },
  {
    id: "rh",
    label: "RH",
    href: "/rh",
    roles: ["ADMIN", "GERENTE"],
  },
  {
    id: "auditoria",
    label: "Auditoria",
    href: "/admin/auditoria",
    roles: ["ADMIN", "GERENTE"],
  },
  {
    id: "admin",
    label: "Admin",
    href: "/admin",
    roles: ["ADMIN", "GERENTE"],
  },
  {
    id: "cockpit",
    label: "Cockpit",
    href: "/cockpit",
    roles: ["ADMIN", "GERENTE", "OPERADOR_PORTARIA", "OPERADOR_GATE", "OPERADOR_PATIO"],
  },
  {
    id: "bi",
    label: "BI",
    href: "/bi",
    roles: ["ADMIN", "GERENTE"],
  },
  {
    id: "grc",
    label: "GRC",
    href: "/grc",
    roles: ["ADMIN", "GERENTE"],
  },
  {
    id: "ssma",
    label: "SSMA",
    href: "/ssma",
    roles: ["ADMIN", "GERENTE"],
  },
];

export const MODULE_META: Record<
  IntranetModuleId,
  { title: string; subtitle: string }
> = {
  dashboard: { title: "Dashboard", subtitle: "Visão geral operacional" },
  portaria: { title: "Portaria", subtitle: "Check-in mobile com QR e vistoria" },
  gate: { title: "Gate CPO", subtitle: "Centro de Operação" },
  cadastros: { title: "Cadastros", subtitle: "Master Data Management" },
  dispatch: { title: "Transportes", subtitle: "Fretes e operação de frota" },
  patio: { title: "Pátio", subtitle: "Operação de pátio" },
  financeiro: { title: "Financeiro", subtitle: "Tesouraria corporativa" },
  rh: { title: "RH", subtitle: "Recursos humanos" },
  admin: { title: "Admin", subtitle: "Administração corporativa" },
  auditoria: { title: "Auditoria", subtitle: "Trilha gerencial classificada" },
  cockpit: { title: "Cockpit", subtitle: "Centro de controle" },
  bi: { title: "BI", subtitle: "Business Intelligence" },
  grc: { title: "GRC", subtitle: "Governança, risco e compliance" },
  ssma: { title: "SSMA", subtitle: "Segurança e meio ambiente" },
};

export const SIDEBAR_CONFIG: Record<IntranetModuleId, IntranetSubMenuItem[]> = {
  portaria: [],
  gate: [
    {
      label: "Criar agendamento",
      href: "/operador/gate/criar-agendamento",
      icon: Calendar,
      description: "Baixa, coleta e demais solicitações — preenchimento manual",
    },
    {
      label: "Autorizações",
      href: "/operador/gate/autorizacoes",
      icon: ShieldCheck,
      badgeKey: "gate.autorizacoes",
      description: "Aprovar solicitações antes da portaria",
    },
    {
      label: "Notificações",
      href: "/operador/gate/notificacoes",
      icon: Bell,
      badgeKey: "gate.notificacoes",
      description: "Alterações na unidade depois da baixa (ID criado)",
    },
    {
      label: "Controle de Gate",
      href: "/operador/gate/controle-entrada-saida",
      icon: ArrowLeftRight,
      badgeKey: "gate.controle",
      description: "Conferência, RIC de entrada/saída e liberação",
    },
    {
      label: "Consulta RIC",
      href: "/operador/gate/consulta-ric",
      icon: FileSearch,
      description: "IDs emitidos — entrada, saída, serviços e reimpressão da RIC",
    },
    {
      label: "Saldo de Unidades",
      href: "/operador/gate/patio",
      icon: Container,
      badgeKey: "gate.patio",
      description: "Estoque no terminal — baia opcional",
    },
    {
      label: "Aluguéis",
      href: "/operador/gate/alugueis",
      icon: Repeat,
      description: "Contratos de unidades próprias — ID independente do pátio",
    },
    {
      label: "Histórico de Contêiner",
      href: "/operador/gate/historico-container",
      icon: History,
      description: "Consultar todas as passagens de um contêiner pelo terminal",
    },
    {
      label: "Previsão de chegada de navios",
      href: "/operador/gate/previsao-navios",
      icon: Ship,
      description: "Line-up ZP21 (Itajaí/Navegantes) — atualização automática",
    },
  ],
  cadastros: [
    {
      label: "Empresa",
      href: "/cadastros/empresa",
      icon: Building2,
      description: "Dados da RL Transportes, tributos e logos (intranet, portais, RIC e e-mail)",
      roles: ["ADMIN", "GERENTE"],
    },
    {
      label: "Pessoas & Entidades",
      href: "/cadastros/pessoas",
      icon: Users,
      description: "Clientes, Colaboradores, Motoristas Internos, Transportadoras, Fornecedores",
    },
    {
      label: "Operacional",
      href: "/cadastros/operacional",
      icon: Boxes,
      description: "Equipamentos, Posições, Origens e destinos",
    },
    {
      label: "Financeiro",
      href: "/cadastros/financeiro",
      icon: DollarSign,
      description: "Bancos, Tabelas de Preços, Tabela de transportes, Serviços, Forma e Prazo de Pagamento",
      roles: ["ADMIN", "GERENTE", "FINANCEIRO"],
    },
    {
      label: "Contratos & Documentos",
      href: "/cadastros/contratos",
      icon: FileText,
      description: "Contratos, Aditivos, Tipos de Documentos, Templates",
    },
    {
      label: "Parâmetros do Sistema",
      href: "/cadastros/parametros",
      icon: Settings,
      description: "Parâmetros gerais, Feriados, SLA, Configurações de Pátio",
      roles: ["ADMIN", "GERENTE"],
    },
    {
      label: "Permissões",
      href: "/cadastros/permissoes",
      icon: ShieldCheck,
      description: "Delegação de poderes — quem pode acessar o quê",
      roles: ["ADMIN"],
    },
  ],
  financeiro: [
    { label: "Tesouraria", href: "/financeiro/tesouraria", icon: Wallet },
    {
      label: "Cadastros Pendentes",
      href: "/financeiro/cadastros-pendentes",
      icon: UserPlus,
      badgeKey: "financeiro.pendencias",
    },
    {
      label: "Forma e prazo",
      href: "/financeiro/condicoes-clientes",
      icon: CreditCard,
    },
    {
      label: "Faturas",
      href: "/financeiro/faturas",
      icon: FileCheck,
      description: "Pacote FAT: IDs encerrados, uma NFS-e e boleto ou PIX",
    },
    { label: "Contas a Pagar", href: "/financeiro/apagar", icon: ArrowDownCircle },
    {
      label: "Provisão de encargos",
      href: "/financeiro/provisao-encargos",
      icon: Calculator,
      description: "Provisão mensal automática — não é título a pagar",
    },
    { label: "Contas a Receber", href: "/financeiro/areceber", icon: ArrowUpCircle },
    {
      label: "Conta corrente",
      href: "/financeiro/conta-corrente",
      icon: BookOpen,
      description: "Crédito e débito manuais do cliente — folga do processo",
      badgeKey: "financeiro.contaCorrente",
    },
    {
      label: "Cessão de titularidade",
      href: "/financeiro/cessao-titularidade",
      icon: Repeat,
      description: "Reemissão após cancelamento de NFS-e",
    },
    { label: "Bancos", href: "/financeiro/bancos", icon: Building },
    { label: "Conciliação", href: "/financeiro/conciliacao", icon: Scale },
  ],
  rh: [
    { label: "Agenda", href: "/rh/agenda", icon: CalendarClock },
    { label: "Colaboradores", href: "/rh/colaboradores", icon: Users },
    { label: "Turnos", href: "/rh/turnos", icon: Timer },
    { label: "Competências", href: "/rh/competencias", icon: Award },
    { label: "Equipe e Escalas", href: "/rh/equipe", icon: Calendar },
    { label: "Estrutura", href: "/rh/estrutura", icon: GitBranch },
    { label: "Jornada", href: "/rh/jornada", icon: Clock },
    { label: "Ponto", href: "/rh/jornada/ponto", icon: Fingerprint },
  ],
  admin: [
    { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
    { label: "Clientes", href: "/admin/clientes", icon: Building2 },
    { label: "Contratos", href: "/admin/contratos", icon: FileText },
    { label: "Serviços", href: "/admin/servicos", icon: Briefcase },
    { label: "Documentos", href: "/admin/documentos", icon: FolderOpen },
    { label: "Executivo", href: "/admin/executivo", icon: TrendingUp },
    { label: "Jurídico", href: "/admin/juridico", icon: Scale },
    { label: "Penalidades", href: "/admin/penalidades", icon: AlertTriangle },
    { label: "SLA Interno", href: "/admin/slainterno", icon: Target },
    { label: "Régua de Cobrança", href: "/admin/config/regua-cobranca", icon: Settings },
  ],
  auditoria: [
    {
      label: "Todas",
      href: "/admin/auditoria",
      icon: Search,
      description: "Trilha unificada — operação, cadastro e faturamento",
    },
    {
      label: "Normais",
      href: "/admin/auditoria?classificacao=VERDE",
      icon: CheckCircle,
      description: "Inclusões, solicitações e processos comuns",
    },
    {
      label: "Alterações",
      href: "/admin/auditoria?classificacao=AMARELO",
      icon: History,
      description: "Mudança em dado já gravado",
    },
    {
      label: "Críticas",
      href: "/admin/auditoria?classificacao=VERMELHO",
      icon: Shield,
      description: "Senha de gestor, fluxo ou faturamento",
    },
  ],
  cockpit: [
    { label: "Dashboard", href: "/cockpit", icon: LayoutDashboard },
    { label: "Executivo", href: "/cockpit/executivo", icon: TrendingUp },
    { label: "Heatmap", href: "/cockpit/heatmap", icon: Grid3x3 },
  ],
  bi: [
    { label: "Dashboard", href: "/bi", icon: LayoutDashboard },
    { label: "Corporativo", href: "/bi/corporativo", icon: Building },
    { label: "Financeiro", href: "/bi/financeiro", icon: DollarSign },
    { label: "Operacional", href: "/bi/operacional", icon: Activity },
    { label: "Torre de Controle", href: "/bi/torre-de-controle", icon: Radio },
    { label: "Visão Operacional", href: "/bi/visao-operacional", icon: Eye },
  ],
  grc: [
    { label: "Dashboard", href: "/grc", icon: LayoutDashboard },
    { label: "Executivo", href: "/grc/executivo", icon: TrendingUp },
    { label: "Governança", href: "/grc/governanca", icon: Shield },
    { label: "Riscos", href: "/grc/riscos", icon: AlertCircle },
  ],
  ssma: [
    { label: "Dashboard", href: "/ssma", icon: LayoutDashboard },
    { label: "Compliance", href: "/ssma/compliance", icon: ShieldCheck },
    { label: "Incidentes", href: "/ssma/incidentes", icon: AlertTriangle },
    { label: "PTW", href: "/ssma/ptw", icon: FileCheck },
  ],
  dispatch: [
    { label: "Visão Geral", href: "/operador/transportes", icon: LayoutDashboard },
    {
      label: "Fretes",
      href: "/operador/fretes",
      icon: Truck,
      openInNewTab: true,
      description: "Planilha — abre em nova aba",
    },
    { label: "Dispatch Board", href: "/operador/dispatch", icon: Send },
    {
      label: "Localização",
      href: "/operador/localizacao-motoristas",
      icon: MapPin,
      description: "GPS dos motoristas internos e terceiros da RL",
    },
  ],
  patio: [
    { label: "Visão Geral", href: "/operador/patio", icon: Grid3x3 },
  ],
  dashboard: [
    { label: "Dashboard Geral", href: "/operador/dashboard", icon: LayoutDashboard },
  ],
};

export const ADVANCED_MODULES: IntranetAdvancedGroup[] = [
  {
    label: "AGI",
    items: [
      { label: "Self-Correcting", href: "/agi/self-correcting" },
      { label: "Self-Learning", href: "/agi/self-learning" },
      { label: "Self-Optimizing", href: "/agi/self-optimizing" },
    ],
  },
  {
    label: "AOG",
    items: [
      { label: "Core", href: "/aog/core" },
      { label: "Disciplina", href: "/aog/disciplina" },
      { label: "Self-Regulation", href: "/aog/self-regulation" },
    ],
  },
  {
    label: "SDT",
    items: [
      { label: "Autopilot", href: "/sdt/autopilot" },
      { label: "Decision Engine", href: "/sdt/decision-engine" },
      { label: "Estratégico", href: "/sdt/estrategico" },
    ],
  },
  {
    label: "AI Console",
    items: [
      { label: "Estratégico", href: "/ai-console/estrategico" },
      { label: "Financeiro", href: "/ai-console/financeiro" },
      { label: "Operacional", href: "/ai-console/operacional" },
    ],
  },
  {
    label: "Digital Twin",
    items: [
      { label: "3D", href: "/digital-twin/3d" },
      { label: "Terminal", href: "/digital-twin/terminal" },
      { label: "What-If", href: "/digital-twin/what-if" },
    ],
  },
];

export function canAccessIntranetModule(role: string, module: IntranetNavItem): boolean {
  if (role === "SUPER_ADMIN") return true;
  if (!module.roles) return true;
  return module.roles.includes(role);
}

export function canAccessIntranetSidebarItem(role: string, item: IntranetSubMenuItem): boolean {
  if (role === "SUPER_ADMIN") return true;
  if (!item.roles) return true;
  return item.roles.includes(role);
}

export function visibleIntranetModules(role: string): IntranetNavItem[] {
  return MODULOS_INTRANET.filter((m) => canAccessIntranetModule(role, m));
}
