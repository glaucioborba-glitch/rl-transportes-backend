"use client";

import { OperadorStatusBadge, type OcrCheckState } from "@/components/operador/operador-status-badge";
import { Input } from "@/components/ui/input";
import { PhotoUploader, type PhotoEntry } from "@/components/operador/photo-uploader";

type Props = {
  conferenciaOk: boolean;
  setConferenciaOk: (v: boolean) => void;
  avariaDescricao: string;
  setAvariaDescricao: (v: string) => void;
  avariaFotos: PhotoEntry[];
  setAvariaFotos: (v: PhotoEntry[]) => void;
  lacreDescricao: string;
  setLacreDescricao: (v: string) => void;
  lacreFotos: PhotoEntry[];
  setLacreFotos: (v: PhotoEntry[]) => void;
  ocrEstado: OcrCheckState;
};

export function PortariaChecklist({
  conferenciaOk,
  setConferenciaOk,
  avariaDescricao,
  setAvariaDescricao,
  avariaFotos,
  setAvariaFotos,
  lacreDescricao,
  setLacreDescricao,
  lacreFotos,
  setLacreFotos,
  ocrEstado,
}: Props) {
  return (
    <div className="space-y-4 rounded-xl border border-white/10 bg-[#0a0d12] p-4">
      <h3 className="text-lg font-semibold text-white">Checklist obrigatório</h3>

      <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-white/10 bg-black/30 px-3 py-2">
        <input
          type="checkbox"
          checked={conferenciaOk}
          onChange={(e) => setConferenciaOk(e.target.checked)}
          className="h-5 w-5 accent-[var(--accent)]"
        />
        <span className="text-sm text-slate-200">Conferência visual do conjunto cavalo + equipamento</span>
      </label>

      <div>
        <p className="mb-2 text-sm text-slate-400">Registro de avarias (quando houver)</p>
        <Input
          placeholder="Descrição textual"
          value={avariaDescricao}
          onChange={(e) => setAvariaDescricao(e.target.value)}
          className="mb-2 border-white/15 bg-black/40 text-white"
        />
        <PhotoUploader label="Fotos de avaria" photos={avariaFotos} onChange={setAvariaFotos} />
      </div>

      <div>
        <p className="mb-2 text-sm text-slate-400">Lacre (contêiner cheio)</p>
        <Input
          placeholder="Número / observação do lacre"
          value={lacreDescricao}
          onChange={(e) => setLacreDescricao(e.target.value)}
          className="mb-2 border-white/15 bg-black/40 text-white"
        />
        <PhotoUploader label="Fotos do lacre" photos={lacreFotos} onChange={setLacreFotos} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-400">Status OCR:</span>
        <OperadorStatusBadge
          variant={
            ocrEstado === "sucesso" ? "sucesso" : ocrEstado === "falhou" ? "falhou" : "pendente"
          }
        >
          {ocrEstado === "sucesso" ? "Sucesso" : ocrEstado === "falhou" ? "Falhou" : "Pendente"}
        </OperadorStatusBadge>
      </div>
    </div>
  );
}
