import imageCompression from "browser-image-compression";
import type { VistoriaAngulo } from "@/lib/gate-vistoria";

const MAX_SIZE_MB = 0.3;
const MAX_WIDTH_OR_HEIGHT = 1920;

export async function compressVistoriaPhoto(file: File): Promise<File> {
  const compressed = await imageCompression(file, {
    maxSizeMB: MAX_SIZE_MB,
    maxWidthOrHeight: MAX_WIDTH_OR_HEIGHT,
    useWebWorker: true,
    fileType: "image/jpeg",
  });
  const name = file.name.replace(/\.\w+$/, "") + ".jpg";
  return new File([compressed], name, { type: "image/jpeg" });
}

export function vistoriaFieldName(angulo: VistoriaAngulo): string {
  return `foto_${angulo}`;
}
