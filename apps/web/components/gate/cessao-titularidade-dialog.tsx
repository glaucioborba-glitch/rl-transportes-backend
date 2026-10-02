"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatIsoDisplay } from "@/lib/container-display";
import { toast } from "@/lib/toast";
import { ApiError } from "@/lib/api/staff-client";
import { sanitizeCorporateDocumento } from "@/lib/api/corporate-auth-client";
import { formatCpfBr } from "@/lib/format-cpf-cnpj-br";
import { validarCPF } from "@/lib/br-documents";
import {
  abrirCessaoComprovante,
  fetchCessaoClientes,
  fetchCessaoPreview,
  postCessaoAutorizacaoGerente,
  postExecutarCessao,
  type CessaoCliente,
  type CessaoPreview,
} from "@/lib/gate/operacao-api";

const ETAPA_LABEL: Record<CessaoPreview["etapa"], string> = {
  DURANTE_ESTADIA: "Durante a estadia (ID no pátio)",
  POS_SAIDA: "Após a saída (sem NFS-e)",
  POS_NFSE: "Após NFS-e (financeiro precisa cancelar a nota)",
};

export function CessaoTitularidadeDialog({
  unidadeProcessoId,
  open,
  onOpenChange,
  onConcluida,
}: {
  unidadeProcessoId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConcluida?: () => void;
}) {
  const [preview, setPreview] = useState<CessaoPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [opcoes, setOpcoes] = useState<CessaoCliente[]>([]);
  const [escolhido, setEscolhido] = useState<CessaoCliente | null>(null);
  const [motivo, setMotivo] = useState("");
  const [doc, setDoc] = useState("");
  const [senha, setSenha] = useState("");
  const [comprovante, setComprovante] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEscolhido(null);
    setMotivo("");
    setDoc("");
    setSenha("");
    setComprovante(null);
    setQ("");
    setOpcoes([]);
    setLoading(true);
    void fetchCessaoPreview(unidadeProcessoId)
      .then(setPreview)
      .catch((err) => {
        toast.error(err instanceof ApiError ? err.message : "Não foi possível carregar a cessão.");
        onOpenChange(false);
      })
      .finally(() => setLoading(false));
  }, [open, unidadeProcessoId, onOpenChange]);

  async function buscar() {
    if (q.trim().length < 2 || !preview) return;
    try {
      const out = await fetchCessaoClientes(q.trim(), preview.titular.id);
      setOpcoes(out.items);
      if (out.items.length === 0) toast.error("Nenhum cliente aprovado encontrado.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Falha na busca de clientes.");
    }
  }

  async function confirmar() {
    if (!preview || !escolhido) return;
    if (motivo.trim().length < 8) {
      toast.error("Informe o motivo da cessão (mínimo 8 caracteres).");
      return;
    }
    if (!comprovante) {
      toast.error("Anexe o comprovante da solicitação (PDF ou imagem).");
      return;
    }
    if (comprovante.size > 8 * 1024 * 1024) {
      toast.error("O comprovante não pode passar de 8 MB.");
      return;
    }
    const cpf = sanitizeCorporateDocumento(doc);
    if (!validarCPF(cpf)) {
      toast.error("CPF de gerente inválido.");
      return;
    }
    if (!senha.trim()) {
      toast.error("Informe a senha do gerente.");
      return;
    }
    setBusy(true);
    try {
      const auth = await postCessaoAutorizacaoGerente(unidadeProcessoId, cpf, senha);
      const out = await postExecutarCessao(unidadeProcessoId, {
        paraClienteId: escolhido.id,
        motivo: motivo.trim(),
        gerenteToken: auth.token,
        comprovante,
      });
      toast.success(
        out.status === "AGUARDANDO_CANCELAMENTO_NFSE"
          ? `Cessão registrada. Financeiro precisa cancelar a NFS-e e reemitir para ${out.para.nome}.`
          : `${out.idLabel} cedido para ${out.para.nome}.`,
      );
      onOpenChange(false);
      onConcluida?.();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível ceder a titularidade.");
    } finally {
      setBusy(false);
    }
  }

  const bloqueado = Boolean(
    preview?.bloqueioPago || preview?.aguardandoCancelamentoNfse,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ceder titularidade do ID</DialogTitle>
        </DialogHeader>
        {loading || !preview ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              Uso excepcional. A RIC e o solicitante não mudam. B vira titular do ID e assume{' '}
              <strong>toda</strong> a armazenagem já registrada; na saída a fatura sai só no nome de
              B.
            </p>
            <div className="rounded-md border border-border bg-muted/30 p-3 space-y-1">
              <p>
                <span className="text-muted-foreground">ID</span> {preview.idLabel} ·{" "}
                {formatIsoDisplay(preview.unidadeIso)}
              </p>
              <p>
                <span className="text-muted-foreground">Etapa</span> {ETAPA_LABEL[preview.etapa]}
              </p>
              <p>
                <span className="text-muted-foreground">Solicitante (RIC)</span>{" "}
                {preview.solicitante.nome}
              </p>
              <p>
                <span className="text-muted-foreground">Titular atual</span> {preview.titular.nome}
              </p>
            </div>
            {preview.avisos.map((a) => (
              <p key={a} className="text-xs text-amber-200">
                {a}
              </p>
            ))}

            <label className="block space-y-1">
              <span className="text-xs text-muted-foreground">Novo titular (cliente aprovado)</span>
              <div className="flex gap-2">
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Razão social, fantasia ou CNPJ"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void buscar();
                    }
                  }}
                  disabled={bloqueado}
                />
                <Button type="button" variant="outline" onClick={() => void buscar()} disabled={bloqueado}>
                  Buscar
                </Button>
              </div>
            </label>
            {opcoes.length > 0 ? (
              <ul className="max-h-36 overflow-y-auto rounded-md border border-border">
                {opcoes.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className={`w-full px-3 py-2 text-left hover:bg-muted/50 ${
                        escolhido?.id === c.id ? "bg-primary/10" : ""
                      }`}
                      onClick={() => setEscolhido(c)}
                    >
                      <span className="font-medium">{c.nome}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{c.cpfCnpj}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {escolhido ? (
              <p className="text-xs text-emerald-300">Selecionado: {escolhido.nome}</p>
            ) : null}

            <label className="block space-y-1">
              <span className="text-xs text-muted-foreground">Motivo (auditoria)</span>
              <textarea
                className="min-h-[72px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                disabled={bloqueado}
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs text-muted-foreground">
                Comprovante da solicitação (obrigatório)
              </span>
              <Input
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                disabled={bloqueado}
                onChange={(e) => setComprovante(e.target.files?.[0] ?? null)}
              />
              <span className="text-[11px] text-muted-foreground">
                E-mail, carta, WhatsApp ou contrato em PDF/JPG/PNG — até 8 MB. Fica arquivado com a
                cessão.
              </span>
              {comprovante ? (
                <span className="block text-xs text-emerald-300">{comprovante.name}</span>
              ) : null}
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground">CPF do gerente</span>
                <Input
                  value={doc}
                  onChange={(e) => setDoc(formatCpfBr(e.target.value))}
                  disabled={bloqueado}
                  autoComplete="username"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground">Senha do gerente</span>
                <Input
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  disabled={bloqueado}
                  autoComplete="current-password"
                />
              </label>
            </div>
            <p className="text-xs text-muted-foreground">
              A sessão do operador não muda. Só o gerente autoriza a cessão.
            </p>
            {preview.historico.length > 0 ? (
              <div className="space-y-2 rounded-md border border-border p-3">
                <p className="text-xs font-medium text-muted-foreground">Cessões anteriores</p>
                {preview.historico.map((h) => (
                  <div key={h.id} className="flex items-center justify-between gap-2 text-xs">
                    <span>
                      {h.de.nome} → {h.para.nome}
                    </span>
                    {h.comprovante ? (
                      <button
                        type="button"
                        className="text-primary underline"
                        onClick={() =>
                          void abrirCessaoComprovante(h.id).catch((err) =>
                            toast.error(
                              err instanceof ApiError ? err.message : "Falha ao abrir comprovante.",
                            ),
                          )
                        }
                      >
                        {h.comprovante.nome}
                      </button>
                    ) : (
                      <span className="text-muted-foreground">sem anexo</span>
                    )}
                  </div>
                ))}
              </div>
            ) : null}

            <Button
              type="button"
              className="w-full"
              disabled={bloqueado || busy || !escolhido || !comprovante}
              onClick={() => void confirmar()}
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirmar cessão
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
