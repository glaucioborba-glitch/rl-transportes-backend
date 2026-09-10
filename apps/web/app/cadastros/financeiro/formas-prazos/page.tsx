"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { FinanceiroBreadcrumb, FinanceiroTabs } from "../components/financeiro-tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiError } from "@/lib/api/staff-client";
import {
  createCadastroOpcaoPagamento,
  deleteCadastroOpcaoPagamento,
  listCadastroOpcoesPagamento,
  updateCadastroOpcaoPagamento,
  type CadastroOpcaoPagamento,
  type TipoOpcaoPagamento,
} from "@/lib/api/cadastros-opcoes-pagamento-client";
import { toast } from "@/lib/toast";
import { useStaffAuthStore } from "@/stores/staff-auth-store";

type DialogState =
  | { mode: "create"; tipo: TipoOpcaoPagamento }
  | { mode: "edit"; row: CadastroOpcaoPagamento }
  | null;

function labelForma(value: string | null, formas: CadastroOpcaoPagamento[]): string {
  if (!value) return "—";
  return formas.find((f) => f.value === value)?.label ?? value;
}

function formatVencimentos(row: CadastroOpcaoPagamento): string {
  const v = row.vencimentos?.length ? row.vencimentos : row.dias != null ? [row.dias] : [];
  if (!v.length) return "—";
  return v.join(" / ");
}

function resizeVencimentos(current: string[], n: number): string[] {
  const nums = current.map((x) => Number(x)).filter((x) => Number.isFinite(x));
  const count = Math.min(12, Math.max(1, n));
  if (!nums.length) {
    return Array.from({ length: count }, (_, i) => String((i + 1) * 30));
  }
  if (count <= nums.length) return nums.slice(0, count).map(String);
  const next = [...nums];
  const interval =
    next.length >= 2 ? next[next.length - 1] - next[next.length - 2] : next[0] > 0 ? next[0] : 30;
  const step = interval > 0 ? interval : 30;
  while (next.length < count) next.push(next[next.length - 1] + step);
  return next.map(String);
}

function OpcoesTable({
  title,
  description,
  tipo,
  rows,
  formas,
  canWrite,
  onNovo,
  onEditar,
  onExcluir,
}: {
  title: string;
  description: string;
  tipo: TipoOpcaoPagamento;
  rows: CadastroOpcaoPagamento[];
  formas: CadastroOpcaoPagamento[];
  canWrite: boolean;
  onNovo: (tipo: TipoOpcaoPagamento) => void;
  onEditar: (row: CadastroOpcaoPagamento) => void;
  onExcluir: (row: CadastroOpcaoPagamento) => void;
}) {
  const isPrazo = tipo === "PRAZO";
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {canWrite ? (
          <Button variant="default" size="sm" onClick={() => onNovo(tipo)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova opção
          </Button>
        ) : null}
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full">
          <thead className="border-b border-border">
            <tr className="text-xs uppercase tracking-wider text-muted-foreground">
              <th className="p-4 text-left">Nome</th>
              <th className="p-4 text-left">Código</th>
              {isPrazo ? <th className="p-4 text-center">Parcelas</th> : null}
              {isPrazo ? <th className="p-4 text-left">Vencimentos (dias)</th> : null}
              {isPrazo ? <th className="p-4 text-left">Forma vinculada</th> : null}
              <th className="p-4 text-center">Status</th>
              {canWrite ? <th className="p-4 text-center">Ações</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border/50 hover:bg-muted/20">
                <td className="p-4 font-medium">{row.label}</td>
                <td className="p-4 font-mono text-xs text-muted-foreground">{row.value}</td>
                {isPrazo ? (
                  <td className="p-4 text-center tabular-nums">
                    {row.vencimentos?.length || (row.dias != null ? 1 : "—")}
                  </td>
                ) : null}
                {isPrazo ? (
                  <td className="p-4 font-mono text-sm tabular-nums">{formatVencimentos(row)}</td>
                ) : null}
                {isPrazo ? (
                  <td className="p-4 text-sm">{labelForma(row.formaVinculada, formas)}</td>
                ) : null}
                <td className="p-4 text-center">
                  <Badge
                    variant="neutral"
                    className={
                      row.ativo
                        ? "border-green-500/30 bg-green-500/15 text-green-400"
                        : "border-red-500/30 bg-red-500/15 text-red-400"
                    }
                  >
                    {row.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                </td>
                {canWrite ? (
                  <td className="p-4">
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => onEditar(row)} aria-label="Editar">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:text-red-300"
                        onClick={() => onExcluir(row)}
                        aria-label="Excluir"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Nenhuma opção cadastrada.</p>
        ) : null}
      </div>
    </section>
  );
}

export default function FormasPrazosPage() {
  const user = useStaffAuthStore((s) => s.user);
  const canWrite = user?.role === "ADMIN" || user?.role === "GERENTE";
  const [formas, setFormas] = useState<CadastroOpcaoPagamento[]>([]);
  const [prazos, setPrazos] = useState<CadastroOpcaoPagamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [vencimentos, setVencimentos] = useState<string[]>(["30"]);
  const [formaVinculada, setFormaVinculada] = useState("");
  const [saving, setSaving] = useState(false);

  const dialogTipo = dialog?.mode === "edit" ? dialog.row.tipo : dialog?.tipo;
  const isPrazoDialog = dialogTipo === "PRAZO";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [f, p] = await Promise.all([
        listCadastroOpcoesPagamento("FORMA"),
        listCadastroOpcoesPagamento("PRAZO"),
      ]);
      setFormas(f);
      setPrazos(p);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha ao carregar opções");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate(tipo: TipoOpcaoPagamento) {
    setLabel("");
    setValue("");
    setAtivo(true);
    setVencimentos(tipo === "PRAZO" ? ["30"] : ["0"]);
    setFormaVinculada(formas.find((f) => f.value === "FATURAMENTO")?.value ?? formas[0]?.value ?? "");
    setDialog({ mode: "create", tipo });
  }

  function openEdit(row: CadastroOpcaoPagamento) {
    setLabel(row.label);
    setValue(row.value);
    setAtivo(row.ativo);
    setVencimentos(
      row.vencimentos?.length
        ? row.vencimentos.map(String)
        : [row.dias != null ? String(row.dias) : "30"],
    );
    setFormaVinculada(row.formaVinculada ?? "");
    setDialog({ mode: "edit", row });
  }

  async function onSalvar() {
    if (!dialog) return;
    const nome = label.trim();
    if (nome.length < 2) {
      toast.error("Informe um nome com pelo menos 2 caracteres.");
      return;
    }
    if (isPrazoDialog && !formaVinculada) {
      toast.error("Vincule uma forma de pagamento a este prazo.");
      return;
    }
    if (isPrazoDialog) {
      const nums = vencimentos.map((x) => Number(x));
      if (nums.some((n) => !Number.isFinite(n) || n < 0)) {
        toast.error("Informe os dias de cada parcela (0 = à vista).");
        return;
      }
      if (nums.some((n, i) => i > 0 && n <= nums[i - 1]!)) {
        toast.error("Os vencimentos devem ser crescentes (ex.: 7 / 14 / 21).");
        return;
      }
    }
    setSaving(true);
    try {
      const extra = isPrazoDialog
        ? { vencimentos: vencimentos.map((x) => Number(x)), formaVinculada }
        : {};
      if (dialog.mode === "create") {
        await createCadastroOpcaoPagamento({
          tipo: dialog.tipo,
          label: nome,
          value: value.trim() || undefined,
          ativo,
          ...extra,
        });
        toast.success("Opção criada.");
      } else {
        await updateCadastroOpcaoPagamento(dialog.row.id, { label: nome, ativo, ...extra });
        toast.success("Opção atualizada.");
      }
      setDialog(null);
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha ao salvar opção");
    } finally {
      setSaving(false);
    }
  }

  async function onExcluir(row: CadastroOpcaoPagamento) {
    if (!window.confirm(`Excluir a opção "${row.label}"?`)) return;
    try {
      await deleteCadastroOpcaoPagamento(row.id);
      toast.success("Opção excluída.");
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha ao excluir opção");
    }
  }

  return (
    <div className="space-y-6">
      <FinanceiroBreadcrumb current="Forma e prazo" />
      <FinanceiroTabs />

      <div>
        <h1 className="text-2xl font-bold">Forma e prazo</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          O nome do prazo é só o rótulo. Parcelas e vencimentos (ex.: 7 / 14 / 21) geram os boletos.
          Somente ADMIN e GERENTE podem alterar.
        </p>
      </div>

      {loading ? <div className="h-64 animate-pulse rounded-lg border border-border bg-card" /> : null}

      {!loading ? (
        <div className="space-y-10">
          <OpcoesTable
            title="Forma de pagamento"
            description="Meio de liquidação: PIX, faturamento, boleto, etc."
            tipo="FORMA"
            rows={formas}
            formas={formas}
            canWrite={!!canWrite}
            onNovo={openCreate}
            onEditar={openEdit}
            onExcluir={onExcluir}
          />
          <OpcoesTable
            title="Prazo"
            description="Cada prazo define quantas parcelas e em quantos dias cada boleto vence. À vista = 1 parcela em 0 dias + PIX."
            tipo="PRAZO"
            rows={prazos}
            formas={formas}
            canWrite={!!canWrite}
            onNovo={openCreate}
            onEditar={openEdit}
            onExcluir={onExcluir}
          />
        </div>
      ) : null}

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-zinc-800 bg-zinc-950 text-zinc-100">
          <DialogHeader>
            <DialogTitle>{dialog?.mode === "edit" ? "Alterar opção" : "Nova opção"}</DialogTitle>
            <DialogDescription className="text-zinc-400">
              {isPrazoDialog
                ? "Nome visual, número de parcelas e os dias de vencimento de cada boleto."
                : "Esta opção aparecerá como forma de pagamento."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Nome</label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={isPrazoDialog ? "Ex.: 7/14/21 dias" : "Ex.: Boleto"}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Código interno</label>
              <Input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Gerado automaticamente se vazio"
                disabled={dialog?.mode === "edit"}
                className="font-mono"
              />
            </div>
            {isPrazoDialog ? (
              <>
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">Número de parcelas</label>
                  <Input
                    type="number"
                    min={1}
                    max={12}
                    value={vencimentos.length}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (!Number.isFinite(n)) return;
                      setVencimentos((prev) => resizeVencimentos(prev, n));
                    }}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">
                    Vencimento de cada parcela (dias após a emissão)
                  </label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {vencimentos.map((dia, idx) => (
                      <div key={idx}>
                        <span className="mb-1 block text-[11px] text-zinc-500">
                          Parcela {idx + 1}
                        </span>
                        <Input
                          type="number"
                          min={0}
                          value={dia}
                          onChange={(e) => {
                            const next = [...vencimentos];
                            next[idx] = e.target.value;
                            setVencimentos(next);
                            const first = Number(next[0]);
                            const pix = formas.find((f) => f.value === "AVISTA_PIX")?.value;
                            const fat = formas.find((f) => f.value === "FATURAMENTO")?.value;
                            if (next.length === 1 && first === 0 && pix) setFormaVinculada(pix);
                            if ((next.length > 1 || first > 0) && fat) setFormaVinculada(fat);
                          }}
                        />
                      </div>
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    Ex.: 3 parcelas em 7, 14 e 21 geram 3 boletos (valor dividido igualmente).
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">Forma de pagamento vinculada</label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={formaVinculada}
                    onChange={(e) => setFormaVinculada(e.target.value)}
                  >
                    <option value="">Selecione…</option>
                    {formas
                      .filter((f) => f.ativo)
                      .map((f) => (
                        <option key={f.id} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                  </select>
                </div>
              </>
            ) : null}
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
              Ativo (visível nos menus)
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialog(null)}>
              Cancelar
            </Button>
            <Button type="button" disabled={saving} onClick={() => void onSalvar()}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
