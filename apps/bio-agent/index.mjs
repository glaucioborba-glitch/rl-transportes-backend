import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.BIO_AGENT_PORT || 39201);
const HOST = process.env.BIO_AGENT_HOST || '0.0.0.0';
const ROOT = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(ROOT, 'nitgen.ps1');
const BRIDGE = join(ROOT, 'sdk', 'NitgenBridge.exe');

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Allow-Private-Network': 'true',
    'Access-Control-Allow-Local-Network': 'true',
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

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('JSON inválido'));
      }
    });
    req.on('error', reject);
  });
}

function runNitgen(action, extraArgs, timeoutMs) {
  return new Promise((resolve) => {
    const useBridge = existsSync(BRIDGE);
    const child = useBridge
      ? spawn(BRIDGE, [action, ...(extraArgs || [])], {
          windowsHide: false,
          cwd: dirname(BRIDGE),
        })
      : spawn(
          'powershell.exe',
          [
            '-NoProfile',
            '-STA',
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
      resolve({ ok: false, error: 'Tempo esgotado no leitor. Tente de novo.' });
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
        const parsed = JSON.parse(line);
        resolve(parsed);
      } catch {
        resolve({
          ok: false,
          error: stderr.trim() || line || 'Falha ao falar com o leitor Nitgen/Fingertech.',
        });
      }
    });
  });
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
      const out = await runNitgen('health', [], 20000);
      send(res, out.ok ? 200 : 503, out);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/enroll') {
      const out = await runNitgen('enroll', [], 180000);
      send(res, out.ok ? 200 : 400, out);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/verify') {
      const body = await readBody(req);
      const storedFir = typeof body.storedFir === 'string' ? body.storedFir.trim() : '';
      if (storedFir.length < 32) {
        send(res, 400, { ok: false, error: 'Template cadastrado ausente.' });
        return;
      }
      const dir = join(tmpdir(), 'rl-bio-agent');
      mkdirSync(dir, { recursive: true });
      const firPath = join(dir, `${randomBytes(8).toString('hex')}.fir`);
      writeFileSync(firPath, storedFir, { encoding: 'utf8', flag: 'w' });
      try {
        const extra = existsSync(BRIDGE) ? [firPath] : ['-FirFile', firPath];
        const out = await runNitgen('verify', extra, 120000);
        send(res, out.ok ? 200 : 400, { ok: out.ok, matched: Boolean(out.matched), error: out.error });
      } finally {
        try {
          unlinkSync(firPath);
        } catch {
          /* ignore */
        }
      }
      return;
    }

    send(res, 404, { ok: false, error: 'Rota inexistente' });
  } catch (err) {
    send(res, 500, { ok: false, error: err instanceof Error ? err.message : 'Erro no agente' });
  }
});

server.listen(PORT, HOST, () => {
  process.stdout.write(`Agente digital RIC em http://${HOST}:${PORT}\n`);
});
