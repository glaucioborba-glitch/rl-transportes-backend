"use client";

const RULES = [
  "Alterações redundantes em status de solicitação devem passar por duplo-check documentado.",
  "Picos suspeitos de auditoria no mesmo minuto acionam revisão de trilha prioritarizada.",
  "Operador com DOI abaixo de 45 recebe alerta de supervisão e plano de correção.",
  "Exclusões em cadastros críticos exigem aprovação simulada nível gerência.",
  "403 por escopo repetido dispara playbook de segregação de perfis.",
];

export function GovernanceRulesetBoard() {
  return (
    <div className="rounded-2xl border border-zinc-700/50 bg-[#080808] p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-zinc-500">Regras de governança · painel</p>
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-xs text-zinc-300">
        {RULES.map((r, i) => (
          <li key={i}>{r}</li>
        ))}
      </ol>
    </div>
  );
}
