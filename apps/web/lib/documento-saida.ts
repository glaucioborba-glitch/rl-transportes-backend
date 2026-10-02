/** Saída de documento gerado (PDF, imagem, HTML, etc.): download ou impressão. */

import { printViaAgent, probePrintAgent } from "@/lib/print-agent-client";

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
}

export function nomeArquivoDocumento(filename: string, blob: Blob): string {
  const base = filename.replace(/\.[^.]+$/, "") || "documento";
  const type = blob.type.toLowerCase();
  if (type.includes("pdf")) return `${base}.pdf`;
  if (type.startsWith("image/png")) return `${base}.png`;
  if (type.startsWith("image/jpeg") || type.startsWith("image/jpg")) return `${base}.jpg`;
  if (type.startsWith("text/html")) return `${base}.html`;
  if (type.includes("xml")) return `${base}.xml`;
  return filename;
}

function isPdfBlob(blob: Blob): boolean {
  return blob.type.toLowerCase().includes("pdf");
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/** Iframe com HTML blob (mesma origem). Não usar srcdoc: origem opaca quebra blob:/módulos. */
function printHtmlBlob(
  html: string,
  extraCleanup?: () => void,
  autoPrint = true,
): Promise<void> {
  const htmlUrl = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.setAttribute("title", "Impressão");
    iframe.style.position = "fixed";
    iframe.style.inset = "0";
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "0";
    iframe.style.opacity = "0";
    iframe.style.pointerEvents = "none";
    iframe.style.zIndex = "-1";
    let finished = false;
    const cleanup = () => {
      if (finished) return;
      finished = true;
      extraCleanup?.();
      URL.revokeObjectURL(htmlUrl);
      iframe.remove();
      resolve();
    };
    iframe.onload = () => {
      const w = iframe.contentWindow;
      if (!w) {
        extraCleanup?.();
        URL.revokeObjectURL(htmlUrl);
        iframe.remove();
        reject(new Error("Não foi possível abrir a impressão."));
        return;
      }
      try {
        w.addEventListener("afterprint", cleanup, { once: true });
        if (autoPrint) {
          w.focus();
          w.print();
        }
      } catch (e) {
        extraCleanup?.();
        URL.revokeObjectURL(htmlUrl);
        iframe.remove();
        reject(e instanceof Error ? e : new Error("Falha ao imprimir."));
        return;
      }
      window.setTimeout(cleanup, 120_000);
    };
    iframe.src = htmlUrl;
    document.body.appendChild(iframe);
  });
}

/** PDF no visualizador do Chrome — caminho do lab (Ubuntu sem print-agent). */
function printPdfNoNavegador(blob: Blob): Promise<void> {
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank", "noopener");
  if (!win) {
    URL.revokeObjectURL(url);
    throw new Error("Permita pop-ups neste site para imprimir o cupom.");
  }
  return new Promise((resolve) => {
    const tryPrint = () => {
      try {
        win.focus();
        win.print();
      } catch {
        /* o visualizador do Chrome já mostra o PDF */
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      resolve();
    };
    win.addEventListener("load", () => window.setTimeout(tryPrint, 400), { once: true });
    window.setTimeout(tryPrint, 1_200);
  });
}

/**
 * PDF vai pelo agente local (Windows + Epson) quando ele estiver no ar.
 * Sem agente (lab Ubuntu / outro PC), abre a caixa de impressão do navegador.
 */
export async function imprimirDocumento(blob: Blob, printer?: string): Promise<void> {
  const health = await probePrintAgent();
  if (health.ok && health.sumatra) {
    await printViaAgent(blob, printer);
    return;
  }
  if (isPdfBlob(blob)) {
    await printPdfNoNavegador(blob);
    return;
  }
  await printBlob(blob);
}

/** Impressão HTML/imagem no navegador. PDF não deve passar por aqui. */
export async function printBlob(blob: Blob): Promise<void> {
  if (blob.type.startsWith("image/")) {
    const imgUrl = URL.createObjectURL(blob);
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/><title>Impressão</title>
<style>html,body{margin:0;background:#fff}img{max-width:100%;height:auto}@page{margin:8mm}</style></head>
<body><img src="${escapeAttr(imgUrl)}" alt=""/></body></html>`;
    try {
      await printHtmlBlob(html);
    } finally {
      URL.revokeObjectURL(imgUrl);
    }
    return;
  }

  if (blob.type.startsWith("text/html")) {
    await printHtmlBlob(await blob.text());
    return;
  }

  throw new Error("Este formato precisa do agente de impressão. Rode npm run print-agent neste PC.");
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}
