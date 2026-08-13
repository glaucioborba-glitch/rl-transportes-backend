"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Camera,
  Check,
  Loader2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PortariaPhotoButton } from "@/components/operador/portaria/portaria-photo-button";
import {
  fetchOperacao,
  postVistoria,
  processarOcr,
  type OperacaoDto,
} from "@/lib/gate/operacao-api";
import { toast } from "@/lib/toast";

type FotoTipo =
  | "CONTAINER_OCR"
  | "PLACA_OCR"
  | "LADO_FRONTAL"
  | "LADO_TRASEIRO"
  | "LADO_DIREITO"
  | "LADO_ESQUERDO"
  | "LACRE"
  | "AVARIA";

type FotoVistoria = {
  tipo: FotoTipo;
  label: string;
  obrigatoria: boolean;
  foto?: string;
  ocrResult?: string;
  ocrMatch?: boolean;
  ocrConfianca?: number;
  ocrProvider?: string;
};

const FOTOS_OBRIGATORIAS: FotoVistoria[] = [
  { tipo: "CONTAINER_OCR", label: "Número do Contêiner", obrigatoria: true },
  { tipo: "PLACA_OCR", label: "Placa do Cavalo", obrigatoria: true },
  { tipo: "LADO_FRONTAL", label: "Lado Frontal", obrigatoria: true },
  { tipo: "LADO_TRASEIRO", label: "Lado Traseiro (Portas)", obrigatoria: true },
  { tipo: "LADO_DIREITO", label: "Lado Direito", obrigatoria: true },
  { tipo: "LADO_ESQUERDO", label: "Lado Esquerdo", obrigatoria: true },
  { tipo: "LACRE", label: "Lacre", obrigatoria: false },
];

export default function VistoriaPage({ params }: { params: { protocolo: string } }) {
  const router = useRouter();
  const protocolo = decodeURIComponent(params.protocolo);
  const [operacao, setOperacao] = useState<OperacaoDto | null>(null);
  const [fotos, setFotos] = useState<FotoVistoria[]>(FOTOS_OBRIGATORIAS);
  const [fotoAtual, setFotoAtual] = useState<FotoVistoria | null>(null);
  const [avarias, setAvarias] = useState<
    Array<{ foto: string; descricao: string; localizacao: string }>
  >([]);
  const [enviando, setEnviando] = useState(false);
  const [avariaLocal, setAvariaLocal] = useState("");
  const [avariaDesc, setAvariaDesc] = useState("");
  const avariaFotoRef = useRef<string | null>(null);

  useEffect(() => {
    void fetchOperacao(protocolo)
      .then(setOperacao)
      .catch(() => router.push("/operador/portaria"));
  }, [protocolo, router]);

  async function capturarFoto(dataUrl: string, tipoFoto: FotoVistoria) {
    setFotos((prev) =>
      prev.map((f) => (f.tipo === tipoFoto.tipo ? { ...f, foto: dataUrl } : f)),
    );

    if (tipoFoto.tipo === "CONTAINER_OCR" || tipoFoto.tipo === "PLACA_OCR") {
      const esperado =
        tipoFoto.tipo === "CONTAINER_OCR"
          ? operacao?.containerNumero
          : operacao?.placa;
      try {
        const result = await processarOcr(
          dataUrl,
          tipoFoto.tipo === "CONTAINER_OCR" ? "CONTAINER" : "PLACA",
          esperado !== "—" ? esperado : undefined,
        );
        setFotos((prev) =>
          prev.map((f) =>
            f.tipo === tipoFoto.tipo
              ? {
                  ...f,
                  ocrResult: result.texto,
                  ocrMatch: result.ocrMatch,
                  ocrConfianca: result.confianca,
                  ocrProvider: result.provider,
                }
              : f,
          ),
        );
        if (result.ocrMatch && result.texto) {
          toast.success(
            `${tipoFoto.label} lido: ${result.texto} ✓ (${Math.round(result.confianca * 100)}%)`,
          );
        } else if (result.texto) {
          toast.warning(
            `${tipoFoto.label} lido: ${result.texto} — não confere com o esperado (${esperado}). Confiança: ${Math.round(result.confianca * 100)}%`,
          );
        } else {
          toast.error(
            `Não foi possível ler o ${tipoFoto.label}. Tire outra foto com mais nitidez.`,
          );
        }
      } catch {
        toast.message("Foto registrada sem leitura OCR automática.");
      }
    } else {
      toast.success(`${tipoFoto.label} registrada.`);
    }
    setFotoAtual(null);
  }

  const todasObrigatoriasTiradas = fotos.filter((f) => f.obrigatoria).every((f) => f.foto);

  async function enviarVistoria() {
    if (!todasObrigatoriasTiradas) {
      toast.error("Tire todas as fotos obrigatórias antes de enviar.");
      return;
    }
    setEnviando(true);
    try {
      await postVistoria(protocolo, {
        fotos: fotos
          .filter((f) => f.foto)
          .map((f) => ({
            tipo: f.tipo,
            imagem: f.foto!,
            ocrResult: f.ocrResult,
            ocrMatch: f.ocrMatch,
            ocrConfianca: f.ocrConfianca,
            ocrProvider: f.ocrProvider,
          })),
        avarias,
      });
      toast.success("Vistoria enviada! Gate CPO vai reconfirmar.");
      router.push("/operador/portaria");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar vistoria.");
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-4 p-4 pb-28">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-slate-400"
        onClick={() => router.back()}
      >
        <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
      </Button>

      <div className="pt-2">
        <h1 className="text-xl font-bold text-white">Vistoria Fotográfica</h1>
        <p className="mt-1 text-sm text-slate-400">
          {protocolo} · Tire as fotos obrigatórias
        </p>
      </div>

      <div className="rounded-lg border border-white/10 bg-black/30 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs text-slate-400">Progresso</span>
          <span className="text-xs font-medium text-white">
            {fotos.filter((f) => f.foto).length} / {fotos.length} fotos
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full bg-[var(--accent)] transition-all"
            style={{
              width: `${(fotos.filter((f) => f.foto).length / fotos.length) * 100}%`,
            }}
          />
        </div>
      </div>

      <div className="space-y-2">
        {fotos.map((foto) => (
          <button
            key={foto.tipo}
            type="button"
            onClick={() => setFotoAtual(foto)}
            className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
              foto.foto ? "border-green-500/30 bg-green-500/5" : "border-white/10 bg-black/20"
            }`}
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white/5">
              {foto.foto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={foto.foto} alt={foto.label} className="h-full w-full object-cover" />
              ) : (
                <Camera className="h-5 w-5 text-slate-500" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white">{foto.label}</p>
              <div className="mt-0.5 flex items-center gap-2">
                {foto.foto ? (
                  <>
                    <Check className="h-3 w-3 text-green-400" />
                    <span className="text-xs text-green-400">Registrada</span>
                    {foto.ocrResult && (
                      <span
                        className={`text-xs ${foto.ocrMatch ? "text-green-400" : "text-amber-400"}`}
                      >
                        OCR: {foto.ocrResult} {foto.ocrMatch ? "✓" : "✗"}
                        {foto.ocrConfianca != null && (
                          <span className="ml-1 text-slate-500">
                            ({Math.round(foto.ocrConfianca * 100)}% · {foto.ocrProvider})
                          </span>
                        )}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-xs text-slate-500">
                    {foto.obrigatoria ? "Obrigatória" : "Opcional"}
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}

        <button
          type="button"
          onClick={() =>
            setFotoAtual({ tipo: "AVARIA", label: "Registrar Avaria", obrigatoria: false })
          }
          className="flex w-full items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-left"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-red-500/10">
            <AlertCircle className="h-5 w-5 text-red-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-red-400">Registrar Avaria</p>
            <p className="text-xs text-slate-400">
              {avarias.length > 0
                ? `${avarias.length} avaria(s) registrada(s)`
                : "Tirar foto de dano ou avaria"}
            </p>
          </div>
        </button>
      </div>

      {fotoAtual && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 p-6">
          <div className="w-full max-w-sm space-y-4 rounded-xl border border-white/10 bg-[#0c0e12] p-6">
            <div className="text-center">
              <Camera className="mx-auto mb-2 h-10 w-10 text-[var(--accent)]" />
              <h2 className="text-lg font-bold text-white">{fotoAtual.label}</h2>
            </div>

            {fotoAtual.tipo === "AVARIA" ? (
              <div className="space-y-2">
                <Input
                  placeholder="Localização (ex: porta direita)"
                  value={avariaLocal}
                  onChange={(e) => setAvariaLocal(e.target.value)}
                  className="border-white/10 bg-black/40"
                />
                <Input
                  placeholder="Descrição da avaria"
                  value={avariaDesc}
                  onChange={(e) => setAvariaDesc(e.target.value)}
                  className="border-white/10 bg-black/40"
                />
                <PortariaPhotoButton
                  label="Foto da avaria"
                  captured={!!avariaFotoRef.current}
                  onCapture={(url) => {
                    avariaFotoRef.current = url;
                  }}
                />
                <Button
                  type="button"
                  className="w-full"
                  disabled={!avariaFotoRef.current || !avariaLocal || !avariaDesc}
                  onClick={() => {
                    if (!avariaFotoRef.current) return;
                    setAvarias((prev) => [
                      ...prev,
                      {
                        foto: avariaFotoRef.current!,
                        localizacao: avariaLocal,
                        descricao: avariaDesc,
                      },
                    ]);
                    setAvariaLocal("");
                    setAvariaDesc("");
                    avariaFotoRef.current = null;
                    setFotoAtual(null);
                    toast.success("Avaria registrada.");
                  }}
                >
                  Salvar avaria
                </Button>
              </div>
            ) : (
              <PortariaPhotoButton
                label="Tirar foto"
                captured={!!fotos.find((f) => f.tipo === fotoAtual.tipo)?.foto}
                onCapture={(url) => void capturarFoto(url, fotoAtual)}
              />
            )}

            <Button
              type="button"
              variant="outline"
              className="w-full border-white/10"
              onClick={() => setFotoAtual(null)}
            >
              <X className="mr-2 h-4 w-4" /> Cancelar
            </Button>
          </div>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 border-t border-white/10 bg-[#080a0d]/95 p-4 backdrop-blur">
        <div className="mx-auto max-w-md">
          <Button
            type="button"
          data-testid="submit-vistoria-btn"
            className="h-12 w-full text-base"
            disabled={!todasObrigatoriasTiradas || enviando}
            onClick={() => void enviarVistoria()}
          >
            {enviando ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Enviando...
              </>
            ) : (
              <>
                Enviar Vistoria para Gate CPO <Check className="ml-2 h-5 w-5" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
