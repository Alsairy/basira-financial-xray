import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const bundled = join(
  homedir(),
  '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3',
);
const python =
  process.env.PYTHON_BIN ||
  (existsSync(join(root, '.venv/bin/python'))
    ? join(root, '.venv/bin/python')
    : existsSync(bundled)
      ? bundled
      : 'python3');
if (Number(process.versions.node.split('.')[0]) < 24) {
  console.error('Basira requires Node.js 24 or newer.');
  process.exit(1);
}
if (!existsSync(join(root, 'dist/index.html'))) {
  console.error('Run pnpm build before starting Basira.');
  process.exit(1);
}
const check = spawnSync(python, ['-c', 'import openpyxl,pypdf'], { stdio: 'pipe' });
if (check.status !== 0) {
  console.error('Install Python dependencies with: python -m pip install -r requirements.lock.txt');
  process.exit(1);
}
const port = process.env.PORT || '4317';
try {
  const r = await fetch(`http://127.0.0.1:${port}/api/health`, {
    signal: AbortSignal.timeout(800),
  });
  if (r.ok && (await r.json()).service === 'basira') {
    console.log(`Basira is already running at http://127.0.0.1:${port}`);
    process.exit(0);
  }
} catch {}
const child = spawn(process.execPath, ['server/index.mjs'], {
  cwd: root,
  env: { ...process.env, PYTHON_BIN: python },
  stdio: 'inherit',
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code) => process.exit(code || 0));
