"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Container, Loader2, Save, X } from "lucide-react";
import { CADASTRO_FORM_CLASS, FormField, FormSection } from "@/components/cadastros/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/staff-client";
import {
  createCadastroUnidadeAluguel,
  getCadastroUnidadeAluguel,
  updateCadastroUnidadeAluguel,
  type UnidadeAluguelStatus,
} from "@/lib/api/cadastros-unidades-aluguel-client";
import { listCadastrosTiposContainer } from "@/lib/api/cadastros-tipos-container-client";
import { formatContainerISO, stripContainerISO } from "@/utils/containerFormatter";
import { toast } from "@/lib/toast";

const SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

export function UnidadeAluguelForm({ unidadeId }: { unidadeId?: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(unidadeId));
  const [iso, setIso] = useState("");
  const [tipo, setTipo] = useState("");
  const [tamanho, setTamanho] = useState("40'");
  const [status, setStatus] = useState<UnidadeAluguelStatus>("DISPONIVEL");
  const [observacao, setObservacao] = useState("");
  const [alugada, setAlugada] = useState(false);
  const [tipos, setTipos] = useState<Array<{ codigo: string; nome: string; tamanhos: string[] }>>([]);

  useEffect(() => {
    void listCadastrosTiposContainer().then((r) => setTipos(r.items.filter((t) => t.ativo)));
  }, []);

  useEffect(() => {
    if (!unidadeId) return;
    let on = true;
    void (async () => {
      try {
        const data = await getCadastroUnidadeAluguel(unidadeId);
        if (!on) return;
        setIso(formatContainerISO(data.unidadeIso) || data.unidadeIso);
        setTipo(data.tipoContainerCodigo);
        setTamanho(data.containerTamanho);
        setStatus(data.status);
        setObservacao(data.observacao ?? "");
        setAlugada(data.status === "ALUGADA");
      } catch {
        toast.error("Erro ao carregar unidade.");
      } finally {
        if (on) setLoading(false);
      }
    })();
    return () => {
      on = false;
    };
  }, [unidadeId]);

  const tipoSel = tipos.find((t) => t.codigo === tipo);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (iso.trim().length < 4 || !tipo) {
      toast.error("Informe o ISO e o tipo.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        unidadeIso: stripContainerISO(iso),
        tipoContainerCodigo: tipo,
        containerTamanho: tamanho,
        status: alugada ? undefined : status,
        observacao: observacao || undefined,
      };
      if (unidadeId) {
        await updateCadastroUnidadeAluguel(unidadeId, payload);
        toast.success("Unidade atualizada.");
      } else {
        await createCadastroUnidadeAluguel(payload);
        toast.success("Unidade cadastrada na frota de aluguel.");
      }
      router.push("/cadastros/operacional/unidades-aluguel");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="h-64 animate-pulse rounded-lg border border-border bg-card" />;

  return (
    <form onSubmit={handleSubmit} className={CADASTRO_FORM_CLASS}>
      <div>
        <h1 className="text-2xl font-bold">{unidadeId ? "Editar unidade de aluguel" : "Nova unidade de aluguel"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Frota própria da RL. O aluguel é um ID; se o cliente hospedar a caixa no pátio, o Gate abre outro ID.
        </p>
      </div>

      <FormSection title="Unidade" icon={Container}>
        <div className="flex flex-wrap gap-4">
          <FormField label="ISO" required size="md">
            <Input
              value={iso}
              onChange={(e) => setIso(formatContainerISO(e.target.value))}
              className="uppercase"
              maxLength={16}
              disabled={alugada}
            />
          </FormField>
          <FormField label="Tipo" required className="min-w-[14rem] flex-1">
            <select
              className={SELECT_CLASS}
              value={tipo}
              disabled={alugada}
              onChange={(e) => {
                setTipo(e.target.value);
                const t = tipos.find((x) => x.codigo === e.target.value);
                if (t?.tamanhos[0]) setTamanho(t.tamanhos[0]);
              }}
            >
              <option value="">Selecione</option>
              {tipos.map((t) => (
                <option key={t.codigo} value={t.codigo}>
                  {t.codigo} — {t.nome}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Tamanho" required size="sm">
            <select
              className={SELECT_CLASS}
              value={tamanho}
              disabled={alugada}
              onChange={(e) => setTamanho(e.target.value)}
            >
              {(tipoSel?.tamanhos.length ? tipoSel.tamanhos : ["20'", "40'"]).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </FormField>
        </div>
        <div className="mt-4 flex flex-wrap gap-4">
          <FormField label="Situação" size="md">
            <select
              className={SELECT_CLASS}
              value={status}
              disabled={alugada}
              onChange={(e) => setStatus(e.target.value as UnidadeAluguelStatus)}
            >
              <option value="DISPONIVEL">Disponível</option>
              <option value="MANUTENCAO">Manutenção</option>
              <option value="USO_PROPRIO">Uso próprio</option>
              <option value="INATIVA">Inativa</option>
              {alugada ? <option value="ALUGADA">Alugada</option> : null}
            </select>
            {status === "USO_PROPRIO" ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Uso interno (escritório, depósito, etc.). Não entra na lista de aluguel.
              </p>
            ) : null}
          </FormField>
          <FormField label="Observação" className="min-w-[16rem] flex-1">
            <Input value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          </FormField>
        </div>
      </FormSection>

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/cadastros/operacional/unidades-aluguel")}
        >
          <X className="mr-2 h-4 w-4" />
          Cancelar
        </Button>
        <Button type="submit" disabled={saving || alugada}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Salvar
        </Button>
      </div>
    </form>
  );
}
