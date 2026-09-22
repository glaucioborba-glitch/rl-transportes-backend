"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ApiError } from "@/lib/api/staff-client";
import {
  baixarAnexoLancamento,
  baixarComprovantePixCredito,
  compensarContaCorrente,
  conferirComprovantePixCredito,
  lancarContaCorrente,
  obterContaCorrente,
  type ContaCorrenteCliente,
  type ContaCorrenteComprovantePendente,
  type ContaCorrenteLancamento,
} from "@/lib/api/conta-corrente-client";
import {
  MOTIVO_CC_OPCOES,
  parseValorBrl,
  type MotivoLancamentoCc,
  type TipoLancamentoCc,
} from "@/lib/financeiro/conta-corrente-display";
import { formatCpfCnpjBr } from "@/lib/format-cpf-cnpj-br";
import { formatBRL, formatContabil } from "@/lib/financeiro/format";
import { isIntranetGestorRole } from "@/lib/intranet/intranet-path-access";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { NotificationBadge } from "@/components/ui/notification-badge";
import {
  PixComprovanteDialog,
  useBlobObjectUrl,
} from "@/components/financeiro/pix-comprovante-dialog";

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
  const [comprovantes, setComprovantes] = useState<ContaCorrenteComprovantePendente[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tipo, setTipo] = useState<TipoLancamentoCc>("CREDITO");
  const [motivo, setMotivo] = useState<MotivoLancamentoCc>("ACORDO_COMERCIAL");
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [referencia, setReferencia] = useState("");
  const [refCompensacao, setRefCompensacao] = useState("");
  const [anexo, setAnexo] = useState<File | null>(null);
  const [anexoKey, setAnexoKey] = useState(0);
  const [obsNegacao, setObsNegacao] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<{ blob: Blob; mime: string; titulo: string } | null>(null);
  const previewUrl = useBlobObjectUrl(preview?.blob ?? null);

  const motivos = useMemo(() => MOTIVO_CC_OPCOES.filter((m) => m.tipos.includes(tipo)), [tipo]);

  useEffect(() => {
    if (!motivos.some((m) => m.value === motivo)) {
      setMotivo(motivos[0]?.value ?? "OUTRO");
    }
  }, [motivo, motivos]);

  const aplicarDetalhe = useCallback(
    (out: {
      cliente: ContaCorrenteCliente;
      lancamentos: ContaCorrenteLancamento[];
      comprovantesPendentes?: ContaCorrenteComprovantePendente[];
    }) => {
      setCliente(out.cliente);
      setLancamentos(out.lancamentos);
      setComprovantes(out.comprovantesPendentes ?? []);
    },
    [],
  );

  const carregar = useCallback(async () => {
    if (!ok || !clienteId) return;
    setLoading(true);
    try {
      aplicarDetalhe(await obterContaCorrente(clienteId));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível abrir a conta.");
    } finally {
      setLoading(false);
    }
  }, [aplicarDetalhe, clienteId, ok]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  function preencherLancamento(comp: ContaCorrenteComprovantePendente) {
    setTipo("CREDITO");
    setMotivo("PIX_MANUAL_FORA_SISTEMA");
    setValor(formatContabil(comp.valor));
    setReferencia(comp.referenciaExterna ?? "");
    setDescricao(
      `Crédito PIX conferido no comprovante ${comp.arquivoNome}${
        comp.referenciaExterna ? ` (ref. ${comp.referenciaExterna})` : ""
      }`,
    );
    toast.success("Dados preenchidos no lançamento. Confira e clique em Lançar.");
  }

  async function verComprovante(comp: ContaCorrenteComprovantePendente) {
    try {
      const out = await baixarComprovantePixCredito(clienteId, comp.id);
      setPreview({
        blob: out.blob,
        mime: out.mime || comp.mimeType,
        titulo: comp.arquivoNome,
      });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível abrir o comprovante.");
    }
  }

  async function verAnexoLancamento(lanc: ContaCorrenteLancamento) {
    try {
      const out = await baixarAnexoLancamento(clienteId, lanc.id);
      setPreview({
        blob: out.blob,
        mime: out.mime || lanc.anexoMime || "application/octet-stream",
        titulo: lanc.anexoNome || "Anexo",
      });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível abrir o anexo.");
    }
  }

  async function decidirComprovante(
    comp: ContaCorrenteComprovantePendente,
    decisao: "APROVADO" | "NEGADO",
  ) {
    const observacao = (obsNegacao[comp.id] ?? "").trim();
    if (decisao === "NEGADO" && observacao.length < 3) {
      toast.error("Descreva a inconsistência para negar o comprovante.");
      return;
    }
    setSaving(true);
    try {
      aplicarDetalhe(
        await conferirComprovantePixCredito(clienteId, comp.id, {
          decisao,
          observacao: observacao || undefined,
        }),
      );
      setObsNegacao((prev) => {
        const next = { ...prev };
        delete next[comp.id];
        return next;
      });
      toast.success(
        decisao === "APROVADO"
          ? "Comprovante aprovado. O cliente foi notificado."
          : "Comprovante negado. O cliente foi notificado.",
      );
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível registrar a decisão.");
    } finally {
      setSaving(false);
    }
  }

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
      aplicarDetalhe(
        await lancarContaCorrente(clienteId, {
          tipo,
          valor: n,
          motivo,
          descricao: descricao.trim(),
          referencia: referencia.trim() || undefined,
          anexo,
        }),
      );
      setValor("");
      setDescricao("");
      setReferencia("");
      setAnexo(null);
      setAnexoKey((k) => k + 1);
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
      aplicarDetalhe(
        await compensarContaCorrente(clienteId, {
          referencia: refCompensacao.trim() || undefined,
        }),
      );
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
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold">{cliente?.razaoSocial ?? "Conta corrente"}</h1>
        <NotificationBadge count={comprovantes.length} />
        <p className="mt-1 w-full text-sm text-muted-foreground">
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

          {comprovantes.map((comp) => (
            <Card key={comp.id} className="border-red-500/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Comprovante PIX para análise
                  <NotificationBadge count={1} />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">Valor informado</p>
                    <p className="text-lg font-semibold tabular-nums">{formatBRL(comp.valor)}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">Referência</p>
                    <p className="text-sm">{comp.referenciaExterna || "—"}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">Arquivo</p>
                    <p className="text-sm">{comp.arquivoNome}</p>
                    <p className="text-xs text-muted-foreground">
                      Enviado em {new Date(comp.createdAt).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-end gap-2">
                    <Button type="button" variant="outline" onClick={() => void verComprovante(comp)}>
                      Ver comprovante
                    </Button>
                    <Button type="button" variant="outline" onClick={() => preencherLancamento(comp)}>
                      Preencher lançamento
                    </Button>
                  </div>
                  <p className="md:col-span-2 text-xs text-muted-foreground">
                    Confira o comprovante e o crédito na conta da empresa. O lançamento continua
                    manual, no formulário abaixo. Aprovado ou Negado envia a resposta às
                    Notificações do cliente.
                  </p>
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-xs text-muted-foreground">
                      Inconsistência (obrigatória para negar)
                    </label>
                    <Input
                      value={obsNegacao[comp.id] ?? ""}
                      onChange={(e) =>
                        setObsNegacao((prev) => ({ ...prev, [comp.id]: e.target.value }))
                      }
                      placeholder="Ex.: valor diferente do PIX recebido; comprovante ilegível"
                    />
                  </div>
                  <div className="md:col-span-2 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      disabled={saving}
                      onClick={() => void decidirComprovante(comp, "APROVADO")}
                    >
                      Aprovado
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-red-500/40 text-red-400"
                      disabled={saving}
                      onClick={() => void decidirComprovante(comp, "NEGADO")}
                    >
                      Negado
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

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
                  <label className="mb-1 block text-xs text-muted-foreground">
                    Adicionar anexo (opcional)
                  </label>
                  <Input
                    key={anexoKey}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={(e) => setAnexo(e.target.files?.[0] ?? null)}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    JPG, PNG ou PDF até 5 MB. Não é obrigatório.
                    {anexo ? ` Selecionado: ${anexo.name}` : ""}
                  </p>
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
                            {l.anexoNome ? (
                              <button
                                type="button"
                                className="mt-1 block text-xs text-sky-400 underline-offset-2 hover:underline"
                                onClick={() => void verAnexoLancamento(l)}
                              >
                                Ver anexo
                              </button>
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

      <PixComprovanteDialog
        open={Boolean(preview)}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
        src={previewUrl}
        mime={preview?.mime ?? ""}
        titulo={preview?.titulo ?? "Comprovante PIX"}
      />
    </div>
  );
}
