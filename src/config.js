import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_SECRET = 'development-only-secret';

function parseDotEnv(content) {
  const values = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
    values[key] = value;
  }
  return values;
}

function loadEnvFile(cwd) {
  const envPath = path.resolve(cwd, '.env');
  if (!fs.existsSync(envPath)) {
    return {};
  }
  return parseDotEnv(fs.readFileSync(envPath, 'utf8'));
}

export function loadConfig(env = process.env, cwd = process.cwd()) {
  const fileEnv = loadEnvFile(cwd);
  const runtimeEnv = { ...fileEnv, ...env };
  const port = Number(runtimeEnv.PORT ?? 3000);
  const host = runtimeEnv.HOST ?? '0.0.0.0';
  const nodeEnv = runtimeEnv.NODE_ENV ?? 'development';
  const databasePath = path.resolve(cwd, runtimeEnv.DATABASE_PATH ?? './pemeliharaan_barang.db');
  const sessionSecret = runtimeEnv.SESSION_SECRET ?? DEFAULT_SECRET;
  const adminUsername = runtimeEnv.ADMIN_USERNAME ?? 'admin';
  const adminPassword = runtimeEnv.ADMIN_PASSWORD ?? 'cijago';
  const timeZone = 'Asia/Jakarta';

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('PORT harus berupa angka positif.');
  }

  if (nodeEnv === 'production' && sessionSecret === DEFAULT_SECRET) {
    throw new Error('SESSION_SECRET wajib diubah saat NODE_ENV=production.');
  }

  return {
    port,
    host,
    nodeEnv,
    databasePath,
    sessionSecret,
    adminUsername,
    adminPassword,
    timeZone,
    cookieSecure: nodeEnv === 'production',
    requestLogging: env.REQUEST_LOGGING !== 'false',
  };
}
