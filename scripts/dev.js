import { spawn } from 'node:child_process';
import net from 'node:net';

const run = (name, args) => {
  const p = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', name], { stdio: 'inherit', shell: process.platform === 'win32' });
  p.on('exit', (code) => { if (code) process.exit(code); });
  return p;
};

const dbUp = () => new Promise((resolve) => {
  const s = net.connect({ port: 5432, host: '127.0.0.1' }, () => { s.end(); resolve(true); });
  s.on('error', () => resolve(false));
});

try { process.loadEnvFile('.env'); } catch {}

const procs = [];
// No database on :5432 (and no DATABASE_URL pointing elsewhere)? Start the embedded one and wait for it.
if (!process.env.DATABASE_URL && !(await dbUp())) {
  procs.push(run('db:local'));
  for (let i = 0; i < 120 && !(await dbUp()); i++) await new Promise((r) => setTimeout(r, 500));
}

procs.push(run('dev:server'), run('dev:client'));
const stop = () => { procs.forEach((p) => p.kill()); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
console.log('\n  Takshashila → open http://localhost:5173\n');
