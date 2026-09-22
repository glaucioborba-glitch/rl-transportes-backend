import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.PRINT_AGENT_PORT || 39202);
const HOST = '127.0.0.1';
const ROOT = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(ROOT, 'print.ps1');
const MAX_BYTES = 25 * 1024 * 1024;

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Allow-Private-Network': 'true',
    'Access-Control-Max-Age': '86400',
  };
}

function send(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    ...corsHeaders(),
    'Content-Length': Buffer.byteLength(json),
  });
  res.end(json);
}

function readRaw(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BYTES) {
        reject(new Error('Documento grande demais para imprimir (máx. 25 MB).'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function runPrintPs(action, extraArgs, timeoutMs) {
  return new Promise((resolve) => {
    const child = spawn(
      'powershell.exe',
      [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        SCRIPT,
        '-Action',
        action,
        ...(extraArgs || []),
      ],
      { windowsHide: true },
    );
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      resolve({ ok: false, error: 'Tempo esgotado na impressão.' });
    }, timeoutMs);
    child.stdout.on('data', (d) => {
      stdout += d.toString('utf8');
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString('utf8');
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ ok: false, error: err.message });
    });
    child.on('close', () => {
      clearTimeout(timer);
      const line = stdout.trim().split(/\r?\n/).filter(Boolean).pop() || '';
      try {
        resolve(JSON.parse(line));
      } catch {
        resolve({
          ok: false,
          error: stderr.trim() || line || 'Falha ao falar com o spooler do Windows.',
        });
      }
    });
  });
}

function extForType(contentType) {
  const t = (contentType || '').toLowerCase();
  if (t.includes('png')) return '.png';
  if (t.includes('jpeg') || t.includes('jpg')) return '.jpg';
  if (t.includes('html')) return '.html';
  return '.pdf';
}

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${HOST}`);

  try {
    if (req.method === 'GET' && url.pathname === '/health') {
      const out = await runPrintPs('list', [], 20000);
      send(res, out.ok ? 200 : 503, {
        ok: Boolean(out.ok),
        sumatra: Boolean(out.sumatra),
        printers: out.printers ?? [],
        error: out.error,
      });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/printers') {
      const out = await runPrintPs('list', [], 20000);
      send(res, out.ok ? 200 : 503, out);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/print') {
      const buf = await readRaw(req);
      if (!buf.length) {
        send(res, 400, { ok: false, error: 'Nenhum documento recebido.' });
        return;
      }
      const printer = (url.searchParams.get('printer') || '').trim();
      const dir = join(tmpdir(), 'rl-print-agent');
      mkdirSync(dir, { recursive: true });
      const ext = extForType(req.headers['content-type']);
      const filePath = join(dir, `${randomBytes(8).toString('hex')}${ext}`);
      writeFileSync(filePath, buf);
      try {
        const extra = ['-File', filePath];
        if (printer) extra.push('-Printer', printer);
        const out = await runPrintPs('print', extra, 90000);
        send(res, out.ok ? 200 : 400, out);
      } finally {
        setTimeout(() => {
          try {
            unlinkSync(filePath);
          } catch {
            /* spooler ainda pode estar lendo */
          }
        }, 30_000);
      }
      return;
    }

    send(res, 404, { ok: false, error: 'Rota inexistente' });
  } catch (err) {
    send(res, 500, { ok: false, error: err instanceof Error ? err.message : 'Erro no agente' });
  }
});

server.listen(PORT, HOST, () => {
  process.stdout.write(`Agente de impressão RIC em http://${HOST}:${PORT}\n`);
});
