import { createHttpServer } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const { server, close } = createHttpServer(config);

server.listen(config.port, config.host, () => {
  console.log(
    `Server berjalan di http://${config.host}:${config.port} dengan database ${config.databasePath}`,
  );
});

async function shutdown(signal) {
  console.log(`Menerima ${signal}, mematikan server secara aman...`);
  try {
    await close();
    process.exit(0);
  } catch (error) {
    console.error('Gagal menutup server:', error);
    process.exit(1);
  }
}

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
