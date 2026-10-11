/**
 * The "Book a 20-minute call" target. Only an https:// URL is accepted; anything
 * else (empty, malformed, another scheme) gives '', and no booking button renders.
 */
export function bookingUrlFrom(raw: string | undefined): string {
  const value = (raw ?? '').trim();
  if (!value) return '';
  try {
    return new URL(value).protocol === 'https:' ? value : '';
  } catch {
    return '';
  }
}

/**
 * The value in src/config.ts, unless the BOOKING_URL environment variable is set
 * for this build (even to ''), which wins. Tests and screenshots use that with a
 * dummy value; the real URL is committed in src/config.ts, never in a test.
 */
export function resolveBookingUrl(fromFile: string, env: Record<string, string | undefined> = process.env): string {
  return bookingUrlFrom(env.BOOKING_URL !== undefined ? env.BOOKING_URL : fromFile);
}
