import { spawn } from 'node:child_process';

const run = (name, args) => {
  const p = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', name], { stdio: 'inherit', shell: process.platform === 'win32' });
  p.on('exit', (code) => { if (code) process.exit(code); });
  return p;
};

const procs = [run('dev:server'), run('dev:client')];
const stop = () => { procs.forEach((p) => p.kill()); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
console.log('\n  Takshashila → open http://localhost:5173\n');
