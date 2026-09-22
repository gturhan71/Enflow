import { spawn, ChildProcess } from 'node:child_process';
import { BACKEND_DIR } from './testDb';

export interface RunningBackend {
  baseUrl: string;
  proc: ChildProcess;
  stop: () => Promise<void>;
}

/**
 * Izole DB + izole port ile TAM bir backend process baslatir (aynen `pnpm dev`
 * deseni — supertest/app export'u YOK, backend/src/index.ts'e dokunulmadi;
 * yalniz PORT artik env'den okunuyor, bkz. index.ts). Dev tenant-1 backend'i
 * (3002) calisiyor olsa bile CAKISMAZ.
 */
export async function startBackend(opts: { databaseUrl: string; port: number }): Promise<RunningBackend> {
  const baseUrl = `http://localhost:${opts.port}`;
  const proc = spawn('npx', ['ts-node', 'src/index.ts'], {
    cwd: BACKEND_DIR,
    env: {
      ...process.env,
      DATABASE_URL: opts.databaseUrl,
      PORT: String(opts.port),
      NODE_ENV: 'development',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stderrBuf = '';
  proc.stderr?.on('data', (d) => { stderrBuf += d.toString(); });

  const deadline = Date.now() + 30_000;
  let ready = false;
  while (Date.now() < deadline) {
    if (proc.exitCode !== null) {
      throw new Error(`[backendProcess] backend erken cikti (kod ${proc.exitCode}):\n${stderrBuf}`);
    }
    try {
      const res = await fetch(`${baseUrl}/api/setup/status`);
      if (res.ok) { ready = true; break; }
    } catch { /* henuz dinlemiyor, tekrar dene */ }
    await new Promise((r) => setTimeout(r, 300));
  }
  if (!ready) {
    proc.kill();
    throw new Error(`[backendProcess] backend ${opts.port} portunda 30sn icinde hazir olmadi:\n${stderrBuf}`);
  }

  return {
    baseUrl,
    proc,
    stop: () => new Promise((resolve) => {
      proc.once('exit', () => resolve());
      proc.kill('SIGTERM');
      setTimeout(() => { if (proc.exitCode === null) proc.kill('SIGKILL'); }, 5000);
    }),
  };
}
