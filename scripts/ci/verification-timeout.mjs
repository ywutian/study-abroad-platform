// Local verification can run slowly on a shared workstation. This changes only
// the watchdog, never which checks run or their assertions. CI keeps its default.
export function verificationTimeoutMs(env = process.env) {
  const defaultMs = 120_000;
  if (env.CI && env.CI !== 'false') return defaultMs;
  const raw = env.VERIFY_GATE_TIMEOUT_MS;
  if (raw === undefined) return defaultMs;
  if (!/^\d+$/.test(raw)) throw new Error('VERIFY_GATE_TIMEOUT_MS must be an integer');
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < defaultMs || value > 3_600_000) {
    throw new Error('VERIFY_GATE_TIMEOUT_MS must be between 120000 and 3600000');
  }
  return value;
}
