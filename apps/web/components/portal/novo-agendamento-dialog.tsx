"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ApiError,
  criarAgendamentoPortal,
  type CreateAgendamentoPortalPayload,
  type ModalidadeTransporte,
  type StatusCargaAgendamento,
  type TipoOperacaoAgendamento,
} from "@/lib/api/portal-client";
import { toast } from "@/lib/toast";

const selectCls =
  "flex h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white";

export function NovoAgendamentoDialog({ onCreated }: { onCreated?: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [numeroIso, setNumeroIso] = useState("");
  const [dataRef, setDataRef] = useState("");
  const [turno, setTurno] = useState<"MANHA" | "TARDE">("MANHA");
  const [tipoOperacao, setTipoOperacao] = useState<TipoOperacaoAgendamento>("GATE_IN");
  const [modalidadeTransporte, setModalidadeTransporte] =
    useState<ModalidadeTransporte>("FROTA_CLIENTE");
  const [statusCarga, setStatusCarga] = useState<StatusCargaAgendamento>("CHEIO");
  const [localOrigem, setLocalOrigem] = useState("");
  const [localDestino, setLocalDestino] = useState("");

  const exigeOrigem = useMemo(
    () => modalidadeTransporte === "FROTA_FL" && tipoOperacao === "GATE_IN",
    [modalidadeTransporte, tipoOperacao],
  );

  const exigeDestino = useMemo(
    () => modalidadeTransporte === "FROTA_FL" && tipoOperacao === "GATE_OUT",
    [modalidadeTransporte, tipoOperacao],
  );

  function resetForm() {
    setNumeroIso("");
    setDataRef("");
    setTurno("MANHA");
    setTipoOperacao("GATE_IN");
    setModalidadeTransporte("FROTA_CLIENTE");
    setStatusCarga("CHEIO");
    setLocalOrigem("");
    setLocalDestino("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (exigeOrigem && !localOrigem.trim()) {
      toast.error("Informe o local de coleta (origem) para transporte FL.");
      return;
    }
    if (exigeDestino && !localDestino.trim()) {
      toast.error("Informe o local de entrega (destino) para transporte FL.");
      return;
    }

    const payload: CreateAgendamentoPortalPayload = {
      numeroIso: numeroIso.trim().toUpperCase(),
      dataRef,
      turno,
      tipoOperacao,
      modalidadeTransporte,
      statusCarga,
      ...(exigeOrigem ? { localOrigem: localOrigem.trim() } : {}),
      ...(exigeDestino ? { localDestino: localDestino.trim() } : {}),
    };

    setSaving(true);
    try {
      await criarAgendamentoPortal(payload);
      toast.success("Agendamento criado com sucesso.");
      setOpen(false);
      resetForm();
      onCreated?.();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao criar agendamento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Novo agendamento</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo agendamento</DialogTitle>
          <DialogDescription>
            Gate In ou Gate Out com modalidade de transporte (First/Last Mile).
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={(e) => void handleSubmit(e)}>
          <div>
            <label className="text-xs text-slate-500">Tipo de operação</label>
            <select
              className={selectCls}
              value={tipoOperacao}
              onChange={(e) => setTipoOperacao(e.target.value as TipoOperacaoAgendamento)}
            >
              <option value="GATE_IN">Gate In (entrada no depot)</option>
              <option value="GATE_OUT">Gate Out (retirada no depot)</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-500">Contêiner (ISO)</label>
            <Input
              placeholder="MSCU1234567"
              value={numeroIso}
              onChange={(e) => setNumeroIso(e.target.value.toUpperCase())}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-500">Data</label>
              <Input type="date" value={dataRef} onChange={(e) => setDataRef(e.target.value)} required />
            </div>
            <div>
              <label className="text-xs text-slate-500">Turno</label>
              <select
                className={selectCls}
                value={turno}
                onChange={(e) => setTurno(e.target.value as "MANHA" | "TARDE")}
              >
                <option value="MANHA">Manhã</option>
                <option value="TARDE">Tarde</option>
              </select>
            </div>
          </div>

          <fieldset className="space-y-2 rounded-lg border border-white/10 p-3">
            <legend className="px-1 text-xs font-medium text-slate-400">Quem fará o transporte?</legend>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-200">
              <input
                type="radio"
                name="modalidade"
                checked={modalidadeTransporte === "FROTA_CLIENTE"}
                onChange={() => setModalidadeTransporte("FROTA_CLIENTE")}
              />
              Meu transporte
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-200">
              <input
                type="radio"
                name="modalidade"
                checked={modalidadeTransporte === "FROTA_FL"}
                onChange={() => setModalidadeTransporte("FROTA_FL")}
              />
              Transporte FL (coleta/entrega rodoviária)
            </label>
          </fieldset>

          <div>
            <label className="text-xs text-slate-500">Status da carga</label>
            <select
              className={selectCls}
              value={statusCarga}
              onChange={(e) => setStatusCarga(e.target.value as StatusCargaAgendamento)}
            >
              <option value="CHEIO">Cheio (Importação/Exportação)</option>
              <option value="VAZIO">Vazio</option>
            </select>
          </div>

          {exigeOrigem ? (
            <div>
              <label className="text-xs text-slate-500">Local de coleta (origem) *</label>
              <Input
                placeholder="Ex.: Porto de Santos, Terminal XXX"
                value={localOrigem}
                onChange={(e) => setLocalOrigem(e.target.value)}
                required
              />
            </div>
          ) : null}

          {exigeDestino ? (
            <div>
              <label className="text-xs text-slate-500">Local de entrega (destino) *</label>
              <Input
                placeholder="Ex.: Cliente final, CD Campinas"
                value={localDestino}
                onChange={(e) => setLocalDestino(e.target.value)}
                required
              />
            </div>
          ) : null}

          <Button type="submit" disabled={saving}>
            {saving ? "Enviando…" : "Confirmar agendamento"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
