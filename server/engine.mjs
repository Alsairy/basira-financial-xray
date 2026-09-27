import { spawn } from 'node:child_process';
export function invokeEngine(root, request, { timeout = 120000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.env.PYTHON_BIN || 'python3',
      [process.env.ENGINE_PATH || `${root}/engine/cli.py`],
      {
        cwd: root,
        env: { ...process.env, PYTHONUNBUFFERED: '1' },
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );
    let output = '',
      done = false;
    const finish = (err, result) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      err ? reject(err) : resolve(result);
    };
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish(new Error('ENGINE_TIMEOUT'));
    }, timeout);
    child.stdout.on('data', (b) => {
      output += b;
      if (output.length > 25 * 1024 * 1024) {
        child.kill('SIGKILL');
        finish(new Error('ENGINE_OUTPUT_LIMIT'));
      }
    });
    child.stderr.on('data', () => {});
    child.on('error', () => finish(new Error('ENGINE_UNAVAILABLE')));
    child.on('close', (code) => {
      if (code !== 0) return finish(new Error('ENGINE_FAILED'));
      try {
        const r = JSON.parse(output);
        if (r.error) throw Error();
        finish(null, r);
      } catch {
        finish(new Error('ENGINE_INVALID_RESULT'));
      }
    });
    child.stdin.on('error', () => {});
    child.stdin.end(JSON.stringify(request));
  });
}
