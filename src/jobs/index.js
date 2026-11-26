// Periodic housekeeping.
import { purgeExpiredSessions } from '../database/index.js';
import { log } from '../util/logger.js';

const HOUR = 60 * 60 * 1000;

export function startJobs() {
  const purge = () => {
    const removed = purgeExpiredSessions();
    if (removed) log.info(`purged ${removed} expired sessions`);
  };
  purge();
  setInterval(purge, 6 * HOUR).unref();
}
