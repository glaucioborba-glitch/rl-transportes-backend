"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
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
import { sanitizeCorporateDocumento } from "@/lib/api/corporate-auth-client";
import { formatCpfBr } from "@/lib/format-cpf-cnpj-br";
import { validarCPF } from "@/lib/br-documents";
import { excluirHandlingAutomatico } from "@/lib/api/cadastros-tabelas-servicos-client";
import { toast } from "@/lib/toast";
import { formatBRL } from "@/lib/financeiro/format";

export type TipoExclusaoAutomatico = "handling" | "tomada";

const COPY: Record<
  TipoExclusaoAutomatico,
  { titulo: string; descricao: (valor: string) => string; placeholder: string; sucesso: string; erro: string; botao: string }
> = {
  handling: {
    titulo: "Excluir handling",
    descricao: (valor) =>
      `Remove só o handling (${valor}) da pré-fatura. Diária, tomada, frete e extras continuam. Exige senha de gerente ou administrador.`,
    placeholder: "Por que o handling não deve ser cobrado",
    sucesso: "Handling excluído da pré-fatura. As demais despesas continuam.",
    erro: "Não foi possível excluir o handling.",
    botao: "Excluir handling",
  },
  tomada: {
    titulo: "Excluir tomada",
    descricao: (valor) =>
      `Remove só a tomada / energia (${valor}) da pré-fatura. Handling, diária, frete e extras continuam. Exige senha de gerente ou administrador.`,
    placeholder: "Por que a tomada não deve ser cobrada",
    sucesso: "Tomada excluída da pré-fatura. As demais despesas continuam.",
    erro: "Não foi possível excluir a tomada.",
    botao: "Excluir tomada",
  },
};

export function ExcluirHandlingDialog({
  unidadeProcessoId,
  lancamentoId,
  valorTotal,
  tipo = "handling",
  open,
  onOpenChange,
  onExcluido,
}: {
  unidadeProcessoId: string;
  lancamentoId: string;
  valorTotal: number;
  tipo?: TipoExclusaoAutomatico;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExcluido?: () => void;
}) {
  const copy = COPY[tipo];
  const [motivo, setMotivo] = useState("");
  const [doc, setDoc] = useState("");
  const [senha, setSenha] = useState("");
  const [anexo, setAnexo] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMotivo("");
    setDoc("");
    setSenha("");
    setAnexo(null);
  }, [open]);

  async function confirmar() {
    if (motivo.trim().length < 8) {
      toast.error("Informe o motivo da exclusão (mínimo 8 caracteres).");
      return;
    }
    const cpf = sanitizeCorporateDocumento(doc);
    if (!validarCPF(cpf)) {
      toast.error("CPF de gerente inválido.");
      return;
    }
    if (!senha.trim()) {
      toast.error("Informe a senha gerencial.");
      return;
    }
    if (anexo && anexo.size > 8 * 1024 * 1024) {
      toast.error("O documento não pode passar de 8 MB.");
      return;
    }
    setBusy(true);
    try {
      await excluirHandlingAutomatico(unidadeProcessoId, lancamentoId, {
        motivo: motivo.trim(),
        documento: cpf,
        password: senha,
        anexo,
      });
      toast.success(copy.sucesso);
      onOpenChange(false);
      onExcluido?.();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : copy.erro);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-[#0b101c] text-zinc-100 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{copy.titulo}</DialogTitle>
          <DialogDescription>{copy.descricao(formatBRL(valorTotal))}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <label className="block space-y-1">
            <span className="text-xs text-zinc-400">Motivo</span>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-zinc-600 bg-black/40 px-3 py-2 text-sm text-white"
              placeholder={copy.placeholder}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-zinc-400">Documento (opcional, PDF ou imagem)</span>
            <Input
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              className="border-zinc-600 bg-black/40 text-white file:mr-3 file:rounded file:border-0 file:bg-zinc-800 file:px-2 file:py-1 file:text-xs file:text-zinc-200"
              onChange={(e) => setAnexo(e.target.files?.[0] ?? null)}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-zinc-400">CPF gerencial</span>
            <Input
              value={doc}
              onChange={(e) => setDoc(formatCpfBr(e.target.value))}
              inputMode="numeric"
              autoComplete="username"
              className="border-zinc-600 bg-black/40 text-white"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-zinc-400">Senha gerencial</span>
            <Input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete="current-password"
              className="border-zinc-600 bg-black/40 text-white"
            />
          </label>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button
            type="button"
            className="bg-red-800 hover:bg-red-700"
            disabled={busy}
            onClick={() => void confirmar()}
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {copy.botao}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
