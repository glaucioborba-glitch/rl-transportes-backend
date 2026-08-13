import type { ContainerRicPayload } from "@/lib/container-timeline";

export function openRicPrintWindow(payload: ContainerRicPayload) {
  const w = window.open("", "_blank", "noopener,noreferrer,width=820,height=900");
  if (!w) {
    throw new Error("Permita pop-ups para imprimir o RIC.");
  }

  const divergencias =
    payload.divergencias.length > 0
      ? `<ul>${payload.divergencias
          .map((d) => `<li>${escapeHtml(JSON.stringify(d))}</li>`)
          .join("")}</ul>`
      : "<p>Nenhuma divergência registrada.</p>";

  const fotos =
    payload.fotos.length > 0
      ? payload.fotos
          .map(
            (f) =>
              `<img src="${escapeHtml(f)}" alt="" style="width:140px;height:100px;object-fit:cover;margin:4px;border:1px solid #ccc;" />`,
          )
          .join("")
      : "";

  w.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>RIC ${payload.tipo} — ${payload.isoFormatado}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
    h1 { font-size: 18px; margin: 0 0 8px; }
    .meta { font-size: 12px; color: #444; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    td, th { border: 1px solid #ccc; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f3f4f6; width: 32%; }
    @media print { button { display: none; } }
  </style>
</head>
<body>
  <h1>Recibo de Intercâmbio de Contêiner (RIC) — ${payload.tipo}</h1>
  <p class="meta">${escapeHtml(payload.terminal.nome)} · Emitido ${new Date(payload.emitidoEm).toLocaleString("pt-BR")}</p>
  <table>
    <tr><th>Contêiner (ISO)</th><td><strong>${escapeHtml(payload.isoFormatado)}</strong></td></tr>
    <tr><th>Protocolo</th><td>${escapeHtml(payload.protocolo)}</td></tr>
    <tr><th>Data / hora operação</th><td>${new Date(payload.dataHora).toLocaleString("pt-BR")}</td></tr>
    <tr><th>Motorista</th><td>${escapeHtml(payload.transporte.motoristaNome)} · CPF ${escapeHtml(payload.transporte.motoristaCpf)}</td></tr>
    <tr><th>Placas</th><td>${escapeHtml(payload.transporte.placaCavalo)} / ${escapeHtml(payload.transporte.placaCarreta01)}${payload.transporte.placaCarreta02 ? " / " + escapeHtml(String(payload.transporte.placaCarreta02)) : ""}</td></tr>
    <tr><th>Operador terminal</th><td>${escapeHtml(payload.operador.nome)}${payload.operador.email ? " · " + escapeHtml(payload.operador.email) : ""}</td></tr>
    <tr><th>Assinatura RIC (legado)</th><td>${payload.assinaturaRicPresente ? "Presente" : "Não registrada"}</td></tr>
    <tr><th>Hash PDF validado</th><td>${escapeHtml(payload.hashPdfValidado ?? "—")}</td></tr>
    <tr><th>Divergências</th><td>${divergencias}</td></tr>
    ${
      payload.observacoesInternas?.length
        ? `<tr><th>Observações internas</th><td>${payload.observacoesInternas.map(escapeHtml).join("<br/>")}</td></tr>`
        : ""
    }
  </table>
  ${fotos ? `<div style="margin-top:16px"><strong>Evidências fotográficas</strong><div>${fotos}</div></div>` : ""}
  <p style="margin-top:24px;font-size:11px;color:#666">Documento gerado pelo módulo Consulta Container — RL Transportes.</p>
  <button onclick="window.print()" style="margin-top:16px;padding:8px 16px">Imprimir / Salvar PDF</button>
</body>
</html>`);
  w.document.close();
  w.focus();
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
