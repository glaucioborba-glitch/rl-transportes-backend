"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ApiError } from "@/lib/api/staff-client";
import {
  compensarContaCorrente,
  lancarContaCorrente,
  obterContaCorrente,
  type ContaCorrenteCliente,
  type ContaCorrenteLancamento,
} from "@/lib/api/conta-corrente-client";
import {
  MOTIVO_CC_OPCOES,
  parseValorBrl,
  type MotivoLancamentoCc,
  type TipoLancamentoCc,
} from "@/lib/financeiro/conta-corrente-display";
import { formatCpfCnpjBr } from "@/lib/format-cpf-cnpj-br";
import { formatBRL } from "@/lib/financeiro/format";
import { isIntranetGestorRole } from "@/lib/intranet/intranet-path-access";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";

const SELECT_CLASS =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

function saldoClass(situacao: ContaCorrenteCliente["situacao"]) {
  if (situacao === "CREDOR") return "text-emerald-400";
  if (situacao === "DEVEDOR") return "text-amber-400";
  return "text-muted-foreground";
}

export default function ContaCorrenteClientePage() {
  const params = useParams<{ clienteId: string }>();
  const clienteId = params.clienteId;
  const user = useStaffAuthStore((s) => s.user);
  const ok = isIntranetGestorRole(user?.role);

  const [cliente, setCliente] = useState<ContaCorrenteCliente | null>(null);
  const [lancamentos, setLancamentos] = useState<ContaCorrenteLancamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tipo, setTipo] = useState<TipoLancamentoCc>("CREDITO");
  const [motivo, setMotivo] = useState<MotivoLancamentoCc>("ACORDO_COMERCIAL");
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [referencia, setReferencia] = useState("");
  const [refCompensacao, setRefCompensacao] = useState("");

  const motivos = useMemo(() => MOTIVO_CC_OPCOES.filter((m) => m.tipos.includes(tipo)), [tipo]);

  useEffect(() => {
    if (!motivos.some((m) => m.value === motivo)) {
      setMotivo(motivos[0]?.value ?? "OUTRO");
    }
  }, [motivo, motivos]);

  const carregar = useCallback(async () => {
    if (!ok || !clienteId) return;
    setLoading(true);
    try {
      const out = await obterContaCorrente(clienteId);
      setCliente(out.cliente);
      setLancamentos(out.lancamentos);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível abrir a conta.");
    } finally {
      setLoading(false);
    }
  }, [clienteId, ok]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function onLancar(e: React.FormEvent) {
    e.preventDefault();
    const n = parseValorBrl(valor);
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Informe um valor maior que zero.");
      return;
    }
    if (descricao.trim().length < 3) {
      toast.error("Descreva o motivo do lançamento.");
      return;
    }
    setSaving(true);
    try {
      const out = await lancarContaCorrente(clienteId, {
        tipo,
        valor: n,
        motivo,
        descricao: descricao.trim(),
        referencia: referencia.trim() || undefined,
      });
      setCliente(out.cliente);
      setLancamentos(out.lancamentos);
      setValor("");
      setDescricao("");
      setReferencia("");
      toast.success(tipo === "CREDITO" ? "Crédito lançado." : "Débito lançado.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível lançar.");
    } finally {
      setSaving(false);
    }
  }

  async function onCompensar() {
    setSaving(true);
    try {
      const out = await compensarContaCorrente(clienteId, {
        referencia: refCompensacao.trim() || undefined,
      });
      setCliente(out.cliente);
      setLancamentos(out.lancamentos);
      setRefCompensacao("");
      toast.success("Saldo compensado. A conta ficou zerada.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível compensar.");
    } finally {
      setSaving(false);
    }
  }

  if (!ok) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Acesso restrito ao financeiro e à administração.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">{cliente?.razaoSocial ?? "Conta corrente"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {cliente ? formatCpfCnpjBr(cliente.cpfCnpj) : "Lançamentos manuais deste cliente."}
        </p>
      </div>

      {loading && !cliente ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : cliente ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Saldo</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className={`text-3xl font-semibold tabular-nums ${saldoClass(cliente.situacao)}`}>
                  {formatBRL(cliente.saldo)}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{cliente.situacaoLabel}</p>
                <p className="mt-2 max-w-xl text-xs text-muted-foreground">
                  Verde = crédito a usar na próxima fatura. Âmbar = cliente saiu/liberou e ainda
                  deve. A NFS-e não desconta sozinha — quando aplicar, use Compensar.
                </p>
              </div>
              {cliente.situacao !== "ZERADO" ? (
                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">
                      Ref. da fatura/pagamento
                    </label>
                    <Input
                      value={refCompensacao}
                      onChange={(e) => setRefCompensacao(e.target.value)}
                      placeholder="Opcional"
                      className="w-48"
                    />
                  </div>
                  <Button type="button" variant="outline" disabled={saving} onClick={() => void onCompensar()}>
                    Compensar saldo
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Novo lançamento</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="grid gap-3 md:grid-cols-2" onSubmit={(e) => void onLancar(e)}>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Tipo</label>
                  <select className={SELECT_CLASS} value={tipo} onChange={(e) => setTipo(e.target.value as TipoLancamentoCc)}>
                    <option value="CREDITO">Crédito (a favor do cliente)</option>
                    <option value="DEBITO">Débito (em aberto / pagar depois)</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Motivo</label>
                  <select
                    className={SELECT_CLASS}
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value as MotivoLancamentoCc)}
                  >
                    {motivos.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Valor</label>
                  <MoneyInput value={valor} onChange={setValor} />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Referência (opcional)</label>
                  <Input
                    value={referencia}
                    onChange={(e) => setReferencia(e.target.value)}
                    placeholder="ISO, PIX, protocolo, fatura"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs text-muted-foreground">Descrição</label>
                  <Input
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    placeholder="Ex.: acordo da operação de baixa; PIX R$ 2.000 com fatura de R$ 1.800"
                  />
                </div>
                <div className="md:col-span-2">
                  <Button type="submit" disabled={saving}>
                    {saving ? "Gravando…" : "Lançar"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Extrato</CardTitle>
            </CardHeader>
            <CardContent>
              {lancamentos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum lançamento ainda.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="py-2 pr-3 font-medium">Quando</th>
                        <th className="py-2 pr-3 font-medium">Tipo</th>
                        <th className="py-2 pr-3 font-medium">Motivo</th>
                        <th className="py-2 pr-3 font-medium">Descrição</th>
                        <th className="py-2 pr-3 text-right font-medium">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lancamentos.map((l) => (
                        <tr key={l.id} className="border-t border-border">
                          <td className="py-2.5 pr-3 text-muted-foreground">
                            {new Date(l.createdAt).toLocaleString("pt-BR")}
                            {l.createdByNome ? (
                              <span className="mt-0.5 block text-[11px]">{l.createdByNome}</span>
                            ) : null}
                          </td>
                          <td className="py-2.5 pr-3">{l.tipo === "CREDITO" ? "Crédito" : "Débito"}</td>
                          <td className="py-2.5 pr-3">{l.motivoLabel}</td>
                          <td className="py-2.5 pr-3">
                            {l.descricao}
                            {l.referencia ? (
                              <span className="mt-0.5 block text-xs text-muted-foreground">
                                Ref.: {l.referencia}
                              </span>
                            ) : null}
                          </td>
                          <td
                            className={`py-2.5 text-right tabular-nums font-medium ${
                              l.tipo === "CREDITO" ? "text-emerald-400" : "text-amber-400"
                            }`}
                          >
                            {l.tipo === "CREDITO" ? "+" : "−"}
                            {formatBRL(l.valor)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
