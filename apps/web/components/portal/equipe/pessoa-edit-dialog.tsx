"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  ApiError,
  portalAtualizarPessoaAutorizada,
  portalObterPermissoesPessoa,
  portalPatchPermissoesPessoa,
  type PessoaAutorizadaRow,
} from "@/lib/api/portal-client";
import { formatPhoneBr } from "@/lib/nfse/cliente-fiscal";
import { toast } from "@/lib/toast";
import { DEFAULT_PERMISSOES, type PermissoesPessoa } from "@/stores/pessoaPermissoesStore";
import { PermissoesOperacionaisFields } from "./permissoes-operacionais-fields";

type PessoaEditDialogProps = {
  pessoa: PessoaAutorizadaRow | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

export function PessoaEditDialog({ pessoa, open, onClose, onSaved }: PessoaEditDialogProps) {
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [permissoes, setPermissoes] = useState<PermissoesPessoa>({ ...DEFAULT_PERMISSOES });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !pessoa) return;
    setEmail(pessoa.email);
    setTelefone(pessoa.telefone ? formatPhoneBr(pessoa.telefone) : "");
    setLoading(true);
    void portalObterPermissoesPessoa(pessoa.id)
      .then((p) => setPermissoes({ ...DEFAULT_PERMISSOES, ...p }))
      .catch((e) => {
        toast.error(e instanceof ApiError ? e.message : "Não foi possível carregar permissões.");
        setPermissoes({ ...DEFAULT_PERMISSOES });
      })
      .finally(() => setLoading(false));
  }, [open, pessoa]);

  async function handleSave() {
    if (!pessoa) return;
    const tel = telefone.replace(/\D/g, "");
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      toast.error("Informe um e-mail válido.");
      return;
    }
    if (tel && !/^\d{10,11}$/.test(tel)) {
      toast.error("Telefone inválido (DDD + número).");
      return;
    }
    setSaving(true);
    try {
      await Promise.all([
        portalAtualizarPessoaAutorizada(pessoa.id, {
          email: email.trim(),
          telefone: tel || undefined,
        }),
        portalPatchPermissoesPessoa(pessoa.id, permissoes),
      ]);
      toast.success("Alterações salvas.");
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha ao salvar alterações.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar permissões</DialogTitle>
          <DialogDescription>
            {pessoa ? `${pessoa.nome} · ajuste contato e permissões operacionais.` : ""}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando…
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">E-mail</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Telefone</label>
              <Input
                value={telefone}
                onChange={(e) => setTelefone(formatPhoneBr(e.target.value))}
                inputMode="tel"
              />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Permissões operacionais
              </p>
              <PermissoesOperacionaisFields value={permissoes} onChange={setPermissoes} />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={saving || loading}>
            {saving ? "Salvando…" : "Salvar alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
