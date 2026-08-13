"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RhCard } from "@/components/rh/rh-card";
import { ApiError } from "@/lib/api/staff-client";
import {
  CARGO_LABELS,
  createFuncionario,
  fetchFuncionarios,
  inativarFuncionario,
  type CargoFuncionario,
  type FuncionarioRow,
} from "@/lib/api/workforce-rh-client";
import { toast } from "@/lib/toast";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import { cn } from "@/lib/utils";

const CARGOS: CargoFuncionario[] = ["GATE_CHECKER", "OPERADOR_EMPILHADEIRA", "ADMINISTRATIVO"];

export default function RhEquipePage() {
  const allowed = useStaffAuthStore((s) => s.user?.role === "ADMIN" || s.user?.role === "GERENTE");
  const [rows, setRows] = useState<FuncionarioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [cargo, setCargo] = useState<CargoFuncionario>("OPERADOR_EMPILHADEIRA");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchFuncionarios());
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Erro ao carregar equipe");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createFuncionario({ nome, cpf, cargo });
      toast.success("Funcionário cadastrado");
      setNome("");
      setCpf("");
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Falha ao cadastrar");
    } finally {
      setSaving(false);
    }
  }

  async function onInativar(id: string) {
    try {
      await inativarFuncionario(id);
      toast.success("Funcionário inativado");
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Falha ao inativar");
    }
  }

  if (!allowed) return <p className="text-center text-amber-400">Acesso restrito.</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">RH / Equipe</h1>
        <p className="text-sm text-zinc-500">
          Cadastro operacional para dimensionamento preditivo de escalas (gate e pátio).
        </p>
      </div>

      <RhCard title="Novo colaborador" subtitle="CPF único · cargo define capacidade no motor de planning">
        <form onSubmit={(e) => void onCreate(e)} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-zinc-500">Nome</label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} required className="bg-zinc-900/80" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">CPF</label>
            <Input value={cpf} onChange={(e) => setCpf(e.target.value)} required className="bg-zinc-900/80" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Cargo</label>
            <select
              className="flex h-10 w-full rounded-md border border-white/10 bg-zinc-900/80 px-3 text-sm text-white"
              value={cargo}
              onChange={(e) => setCargo(e.target.value as CargoFuncionario)}
            >
              {CARGOS.map((c) => (
                <option key={c} value={c}>
                  {CARGO_LABELS[c]}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <Button type="submit" disabled={saving} className="bg-cyan-700 hover:bg-cyan-600">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
              Cadastrar
            </Button>
          </div>
        </form>
      </RhCard>

      <RhCard title="Equipe cadastrada">
        {loading ? (
          <p className="text-sm text-zinc-500">Carregando…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-zinc-500">Nenhum funcionário cadastrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase text-zinc-500">
                  <th className="px-2 py-2">Nome</th>
                  <th className="px-2 py-2">CPF</th>
                  <th className="px-2 py-2">Cargo</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-white/5">
                    <td className="px-2 py-2 text-white">{r.nome}</td>
                    <td className="px-2 py-2 font-mono text-zinc-400">{r.cpf}</td>
                    <td className="px-2 py-2">{CARGO_LABELS[r.cargo]}</td>
                    <td className="px-2 py-2">
                      <span
                        className={cn(
                          "rounded px-2 py-0.5 text-xs font-semibold",
                          r.status === "ATIVO" ? "bg-emerald-500/20 text-emerald-200" : "bg-zinc-500/20 text-zinc-400",
                        )}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right">
                      {r.status === "ATIVO" ? (
                        <Button type="button" variant="outline" size="sm" onClick={() => void onInativar(r.id)}>
                          Inativar
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </RhCard>
    </div>
  );
}
