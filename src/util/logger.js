// Tiny leveled logger. Set PINNED_LOG_LEVEL=debug for more output.
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = LEVELS[process.env.PINNED_LOG_LEVEL] ?? LEVELS.info;

function write(level, args) {
  if (LEVELS[level] < threshold) return;
  const stamp = new Date().toISOString();
  const out = level === 'error' || level === 'warn' ? console.error : console.log;
  out(`${stamp} ${level.toUpperCase().padEnd(5)}`, ...args);
}

export const log = {
  debug: (...a) => write('debug', a),
  info: (...a) => write('info', a),
  warn: (...a) => write('warn', a),
  error: (...a) => write('error', a),
};
