// Local PostgreSQL without Docker or a system install: npm run db:local
// Matches docker-compose.yml (user/password/db "takshashila" on :5432), so the default DATABASE_URL works.
// Data lives in server/data/pg (git-ignored). If something is already listening on 5432, this does nothing.
import EmbeddedPostgres from 'embedded-postgres';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(root, 'server', 'data', 'pg');
const port = 5432;

const portInUse = () => new Promise((resolve) => {
  const s = net.connect({ port, host: '127.0.0.1' }, () => { s.end(); resolve(true); });
  s.on('error', () => resolve(false));
});

if (await portInUse()) {
  console.log(`  PostgreSQL already running on :${port}, using it.`);
  process.exit(0);
}

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'takshashila',
  password: 'takshashila',
  port,
  persistent: true,
  // Windows defaults to WIN1252; the app requires UTF8 (₹, Indian-language text).
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  onLog: () => {},
  onError: (e) => console.error('[db]', String(e).trim()),
});

const fresh = !fs.existsSync(path.join(dataDir, 'PG_VERSION'));
if (fresh) await pg.initialise();
await pg.start();
if (fresh) await pg.createDatabase('takshashila');
console.log(`  PostgreSQL ready on :${port} (data in server/data/pg)`);

const stop = async () => { await pg.stop().catch(() => {}); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
process.stdin.resume(); // keep running until stopped
