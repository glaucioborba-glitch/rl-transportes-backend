import type { LucideIcon } from "lucide-react";
import {
  ClipboardCheck,
  Factory,
  Fuel,
  History,
  CircleDot,
  Wrench,
} from "lucide-react";

export type ManutencaoAreaId =
  | "abastecimento"
  | "equipamentos"
  | "oficina"
  | "pneus"
  | "checklist"
  | "historico";

export type ManutencaoArea = {
  id: ManutencaoAreaId;
  href: string;
  label: string;
  detalhe: string;
  preview: string;
  accent: string;
  bar: string;
  iconBg: string;
  icon: LucideIcon;
};

export const MANUTENCAO_HUB_HREF = "/operador/manutencao";

export const MANUTENCAO_AREAS: ManutencaoArea[] = [
  {
    id: "abastecimento",
    href: "/operador/manutencao/abastecimento",
    label: "Abastecimento",
    detalhe: "Diesel, horímetro e posto — no pátio ou no tablet da máquina.",
    preview: "Registrar litros, escolher o equipamento e fechar o turno de combustível.",
    accent: "border-amber-400/50 bg-[#12100b]",
    bar: "bg-amber-400",
    iconBg: "bg-amber-400 text-zinc-950",
    icon: Fuel,
  },
  {
    id: "equipamentos",
    href: "/operador/manutencao/equipamentos",
    label: "Equipamentos",
    detalhe: "Preventiva e corretiva das máquinas da empresa.",
    preview: "Plano da empilhadeira, reach stacker e RTG — fora do cadastro MDM.",
    accent: "border-cyan-400/50 bg-[#0b1214]",
    bar: "bg-cyan-400",
    iconBg: "bg-cyan-400 text-zinc-950",
    icon: Wrench,
  },
  {
    id: "oficina",
    href: "/operador/manutencao/oficina",
    label: "Oficina",
    detalhe: "Ordens de serviço, peças e retorno à operação.",
    preview: "Abrir OS, acompanhar o conserto e liberar a máquina.",
    accent: "border-violet-400/50 bg-[#100b16]",
    bar: "bg-violet-400",
    iconBg: "bg-violet-400 text-zinc-950",
    icon: Factory,
  },
  {
    id: "pneus",
    href: "/operador/manutencao/pneus",
    label: "Pneus e esteiras",
    detalhe: "Troca, recapagem e controle de vida útil.",
    preview: "Mapa de eixos e esteiras com desgaste e próxima troca.",
    accent: "border-slate-300/40 bg-[#101214]",
    bar: "bg-slate-300",
    iconBg: "bg-slate-200 text-zinc-950",
    icon: CircleDot,
  },
  {
    id: "checklist",
    href: "/operador/manutencao/checklist",
    label: "Checklist diário",
    detalhe: "Inspeção de início de turno no tablet.",
    preview: "Freio, vazamento, alarme e foto — operador confirma antes de operar.",
    accent: "border-emerald-400/50 bg-[#0b1410]",
    bar: "bg-emerald-400",
    iconBg: "bg-emerald-400 text-zinc-950",
    icon: ClipboardCheck,
  },
  {
    id: "historico",
    href: "/operador/manutencao/historico",
    label: "Histórico",
    detalhe: "Tudo que já passou pela oficina e pelo posto.",
    preview: "Linha do tempo por equipamento: abastecimento, OS e preventiva.",
    accent: "border-rose-400/45 bg-[#140b0e]",
    bar: "bg-rose-400",
    iconBg: "bg-rose-400 text-zinc-950",
    icon: History,
  },
];

export function manutencaoAreaById(id: string): ManutencaoArea | undefined {
  return MANUTENCAO_AREAS.find((a) => a.id === id);
}
