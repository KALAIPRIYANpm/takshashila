// PostgreSQL through `pg`. Queries are written with `?` placeholders; they are numbered ($1, $2…) before sending.
import { AsyncLocalStorage } from 'node:async_hooks';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { config } from './config.js';

// Return counts and sums as numbers (not strings), and DATE columns as 'YYYY-MM-DD' (not a midnight Date in server time).
pg.types.setTypeParser(pg.types.builtins.INT8, Number);
pg.types.setTypeParser(pg.types.builtins.NUMERIC, Number);
pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v);

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseSsl ? { rejectUnauthorized: true } : undefined,
  max: config.databasePoolSize,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});
pool.on('error', (err) => console.error('[db] idle client error', err.message));

const txClient = new AsyncLocalStorage();
const numbered = new Map();
function toPg(sql) {
  let out = numbered.get(sql);
  if (!out) {
    let n = 0;
    out = sql.replace(/\?/g, () => `$${++n}`);
    numbered.set(sql, out);
  }
  return out;
}

/** Runs on the current transaction's connection when inside tx(), otherwise on any pooled connection. */
const query = (sql, args) => (txClient.getStore() || pool).query(toPg(sql), args);

export const all = async (sql, ...args) => (await query(sql, args)).rows;
export const get = async (sql, ...args) => (await query(sql, args)).rows[0];
export const run = (sql, ...args) => query(sql, args);
/** INSERT and return the new row's id. */
export const insert = async (sql, ...args) => (await query(`${sql} RETURNING id`, args)).rows[0].id;

export async function tx(fn) {
  if (txClient.getStore()) return fn();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = await txClient.run(client, fn);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export async function audit(actorId, action, entity, entityId, detail) {
  await run('INSERT INTO audit_log (actor_id, action, entity, entity_id, detail) VALUES (?,?,?,?,?)',
    actorId ?? null, action, entity, entityId ?? null, detail ? JSON.stringify(detail) : null);
}

const MIGRATIONS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

/** Apply server/migrations/*.sql in name order, each once. Safe to run from several servers at the same time. */
export async function migrate() {
  const client = await pool.connect();
  try {
    const { server_encoding: enc } = (await client.query('SHOW server_encoding')).rows[0];
    if (enc !== 'UTF8') throw new Error(`The database uses ${enc} encoding; Takshashila needs UTF8 for ₹ and Indian-language text. Create it with ENCODING 'UTF8'.`);
    await client.query('SELECT pg_advisory_lock(4101)');
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
    const done = new Set((await client.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
    for (const file of fs.readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
      if (done.has(file)) continue;
      await client.query('BEGIN');
      try {
        await client.query(fs.readFileSync(path.join(MIGRATIONS, file), 'utf8'));
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`[db] applied ${file}`);
      } catch (e) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} failed: ${e.message}`);
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock(4101)').catch(() => {});
    client.release();
  }
}

/** Drop everything and rebuild the schema. Used only by the demo seed. */
export async function reset() {
  const tables = ['attendance', 'trainings', 'renewals', 'payments', 'reviews', 'documents', 'opportunities', 'applications',
    'infra_events', 'infra_documents', 'infra_items', 'infra_requests', 'school_photos', 'schools',
    'otps', 'otp_sends', 'audit_log', 'users', 'schema_migrations'];
  await pool.query(`DROP TABLE IF EXISTS ${tables.join(', ')} CASCADE; DROP SEQUENCE IF EXISTS application_code_seq, infra_code_seq;`);
  await migrate();
}
