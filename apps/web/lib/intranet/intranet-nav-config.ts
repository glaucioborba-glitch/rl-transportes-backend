import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Award,
  Boxes,
  Briefcase,
  Building,
  Building2,
  Calendar,
  CheckCircle,
  ClipboardList,
  Clock,
  Container,
  DollarSign,
  Eye,
  FileCheck,
  FileText,
  Fingerprint,
  FolderOpen,
  GitBranch,
  Grid3x3,
  History,
  LayoutDashboard,
  Radio,
  Scale,
  ScanLine,
  Search,
  Send,
  Settings,
  Shield,
  ShieldCheck,
  CheckSquare,
  Target,
  Timer,
  TrendingUp,
  Truck,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";

export type IntranetModuleId =
  | "dashboard"
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
  | "ssma";

export type IntranetNavItem = {
  id: IntranetModuleId;
  label: string;
  href: string;
  roles?: string[];
};

export type IntranetSubMenuItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  badgeKey?: string;
  description?: string;
  roles?: string[];
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
    id: "gate",
    label: "Gate CPO",
    href: "/operador/gate/dashboard",
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
    label: "Dispatch",
    href: "/operador/dispatch",
    roles: ["ADMIN", "GERENTE", "OPERADOR_GATE"],
  },
  {
    id: "patio",
    label: "Pátio",
    href: "/operador/patio",
    roles: ["ADMIN", "GERENTE", "OPERADOR_PATIO", "OPERADOR_GATE"],
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
  gate: { title: "Gate CPO", subtitle: "Centro de Operação" },
  cadastros: { title: "Cadastros", subtitle: "Master Data Management" },
  dispatch: { title: "Dispatch", subtitle: "Gestão de frota" },
  patio: { title: "Pátio", subtitle: "Operação de pátio" },
  financeiro: { title: "Financeiro", subtitle: "Tesouraria corporativa" },
  rh: { title: "RH", subtitle: "Recursos humanos" },
  admin: { title: "Admin", subtitle: "Administração corporativa" },
  cockpit: { title: "Cockpit", subtitle: "Centro de controle" },
  bi: { title: "BI", subtitle: "Business Intelligence" },
  grc: { title: "GRC", subtitle: "Governança, risco e compliance" },
  ssma: { title: "SSMA", subtitle: "Segurança e meio ambiente" },
};

export const SIDEBAR_CONFIG: Record<IntranetModuleId, IntranetSubMenuItem[]> = {
  gate: [
    { label: "Dashboard", href: "/operador/gate/dashboard", icon: LayoutDashboard },
    { label: "Fila de Chegada", href: "/operador/gate/fila", icon: Truck, badgeKey: "gate.fila" },
    { label: "Operação Ativa", href: "/operador/gate/operacao", icon: Activity, badgeKey: "gate.operacao" },
    { label: "Pátio", href: "/operador/gate/patio", icon: Container, badgeKey: "gate.patio" },
    { label: "Despacho", href: "/operador/gate/despacho", icon: CheckCircle, badgeKey: "gate.despacho" },
    { label: "Ordens de Serviço", href: "/operador/gate/os", icon: ClipboardList, badgeKey: "gate.os" },
    {
      label: "Histórico de Contêiner",
      href: "/operador/gate/historico-container",
      icon: History,
      description: "Consultar todas as passagens de um contêiner pelo terminal",
    },
    {
      label: "Autorizações",
      href: "/operador/gate/autorizacoes",
      icon: ShieldCheck,
      badgeKey: "gate.autorizacoes",
    },
    {
      label: "Reconfirmações",
      href: "/operador/gate/reconfirmar",
      icon: CheckSquare,
      badgeKey: "gate.reconfirmacoes",
      description: "Vistorias fotográficas aguardando conferência",
    },
    {
      label: "Portaria",
      href: "/operador/portaria",
      icon: ScanLine,
      description: "Check-in mobile com QR e vistoria fotográfica",
      roles: ["ADMIN", "GERENTE", "OPERADOR_GATE", "OPERADOR_PORTARIA"],
    },
  ],
  cadastros: [
    {
      label: "Pessoas & Entidades",
      href: "/cadastros/pessoas",
      icon: Users,
      description: "Clientes, Colaboradores, Motoristas, Transportadoras, Fornecedores",
    },
    {
      label: "Operacional",
      href: "/cadastros/operacional",
      icon: Boxes,
      description: "Contêineres, Equipamentos, Posições, Tipos de Operação, Turnos",
    },
    {
      label: "Financeiro",
      href: "/cadastros/financeiro",
      icon: DollarSign,
      description: "Bancos, Centros de Custo, Plano de Contas, Tabelas de Preços",
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
    { label: "Contas a Pagar", href: "/financeiro/apagar", icon: ArrowDownCircle },
    { label: "Contas a Receber", href: "/financeiro/areceber", icon: ArrowUpCircle },
    { label: "Bancos", href: "/financeiro/bancos", icon: Building },
    { label: "Conciliação", href: "/financeiro/conciliacao", icon: Scale },
  ],
  rh: [
    { label: "Colaboradores", href: "/rh/colaboradores", icon: Users },
    { label: "Competências", href: "/rh/competencias", icon: Award },
    { label: "Equipe e Escalas", href: "/rh/equipe", icon: Calendar },
    { label: "Estrutura", href: "/rh/estrutura", icon: GitBranch },
    { label: "Jornada", href: "/rh/jornada", icon: Clock },
    { label: "Ponto", href: "/rh/jornada/ponto", icon: Fingerprint },
    { label: "Turnos", href: "/rh/jornada/turnos", icon: Timer },
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
    { label: "Auditoria", href: "/admin/auditoria", icon: Search },
    { label: "Régua de Cobrança", href: "/admin/config/regua-cobranca", icon: Settings },
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
  dispatch: [{ label: "Dispatch Board", href: "/operador/dispatch", icon: Send }],
  patio: [{ label: "Visão Geral", href: "/operador/patio", icon: Grid3x3 }],
  dashboard: [{ label: "Dashboard Geral", href: "/operador/dashboard", icon: LayoutDashboard }],
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
