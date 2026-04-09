import path from 'node:path';

const DEFAULT_SECRET = 'development-only-secret';

export function loadConfig(env = process.env, cwd = process.cwd()) {
  const port = Number(env.PORT ?? 3000);
  const host = env.HOST ?? '0.0.0.0';
  const nodeEnv = env.NODE_ENV ?? 'development';
  const databasePath = path.resolve(cwd, env.DATABASE_PATH ?? './pemeliharaan_barang.db');
  const sessionSecret = env.SESSION_SECRET ?? DEFAULT_SECRET;
  const adminUsername = env.ADMIN_USERNAME ?? 'admin';
  const adminPassword = env.ADMIN_PASSWORD ?? 'cijago';
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
