import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = process.env;
const production = env.NODE_ENV === 'production';

export const config = {
  port: Number(env.PORT || 4000),
  production,
  secret: env.SECRET_KEY || (production ? '' : 'dev-only-change-me-in-production'),
  // Shows the OTP on screen instead of sending an SMS. On by default in development, off in production unless DEMO_MODE=1.
  demoMode: production ? env.DEMO_MODE === '1' : env.DEMO_MODE !== '0',
  databaseUrl: env.DATABASE_URL || (production ? '' : 'postgres://takshashila:takshashila@localhost:5432/takshashila'),
  databaseSsl: env.DATABASE_SSL === '1',          // managed hosts reached over the public internet (Neon, Supabase…)
  databasePoolSize: Number(env.DATABASE_POOL_SIZE || 10),
  uploadDir: env.UPLOAD_DIR || path.join(root, 'server', 'data', 'uploads'),
  clientDist: path.join(root, 'client', 'dist'),
  // Behind Render/Railway/Nginx the client IP arrives in X-Forwarded-For.
  trustProxy: env.TRUST_PROXY ? env.TRUST_PROXY === '1' : production,
  msg91: {
    authKey: env.MSG91_AUTH_KEY || '',
    templateId: env.MSG91_TEMPLATE_ID || '',     // DLT-approved flow template containing the OTP variable
    otpVar: env.MSG91_OTP_VAR || 'otp',          // variable name used in that template, e.g. ##otp##
  },
  maxUploadBytes: 250 * 1024 * 1024,
  sessionDays: 7,
};

/** Refuse to start a production server that is missing something it can't run safely without. */
export function checkConfig() {
  if (!production) return;
  const problems = [];
  if (config.secret.length < 32) problems.push('SECRET_KEY must be set to a random string of at least 32 characters.');
  if (!config.databaseUrl) problems.push('DATABASE_URL must point at the PostgreSQL database.');
  if (!config.demoMode && (!config.msg91.authKey || !config.msg91.templateId)) {
    problems.push('MSG91_AUTH_KEY and MSG91_TEMPLATE_ID are needed to send login codes (or set DEMO_MODE=1 for a demo site).');
  }
  if (problems.length) {
    console.error(`Takshashila can't start:\n  - ${problems.join('\n  - ')}`);
    process.exit(1);
  }
  if (config.demoMode) console.warn('WARNING: DEMO_MODE=1 shows login codes on screen. Anyone can sign in as any user. Never use it with real data.');
}
