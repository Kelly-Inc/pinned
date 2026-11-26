// Boot: migrate the database, optional demo seed, background jobs, listen.
import http from 'node:http';
import { HOST, PORT, DB_PATH, SEED_DEMO } from '../config.js';
import { migrate, seedDatabase, runAs, firstAccount, countPins, countUsers } from '../database/index.js';
import { startJobs } from '../jobs/index.js';
import { handleRequest } from './app.js';
import { v3 } from '../api/core/registry.js';
import { log } from '../util/logger.js';

export function start() {
  migrate();

  if (SEED_DEMO && countPins() === 0) {
    const owner = firstAccount();
    if (owner) {
      const result = runAs(owner.id, () => seedDatabase());
      log.info(`seeded ${result.inserted} demo pins`);
    } else {
      log.warn('PINNED_SEED=1 needs an account first; create one and restart');
    }
  }

  startJobs();

  const server = http.createServer(handleRequest);
  server.listen(PORT, HOST, () => {
    log.info(`Pinned running at http://localhost:${PORT}`);
    log.info(`  ${countUsers()} accounts, ${countPins()} pins, ${v3.routes.length} API routes (${DB_PATH})`);
  });

  const shutdown = (signal) => {
    log.info(`${signal} received, shutting down`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  return server;
}
