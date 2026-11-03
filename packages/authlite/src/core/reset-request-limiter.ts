/**
 * Счётчик запросов сброса пароля на один email в памяти процесса: не больше max за windowMs.
 * Защищает почтовый ящик от потока писем, даже если запросы идут с разных адресов.
 */
export interface ResetRequestLimiter {
  /** true — запрос разрешён и учтён; false — лимит исчерпан. */
  tryAcquire(email: string): boolean;
  /** Сколько адресов сейчас помнит счётчик. */
  size(): number;
}

export function createResetRequestLimiter({
  max,
  windowMs,
  now = Date.now,
}: {
  max: number;
  windowMs: number;
  now?: () => number;
}): ResetRequestLimiter {
  const requestsByEmail = new Map<string, number[]>();
  let lastSweep = now();

  /** Раз в окно убирает забытые адреса, чтобы память не росла от потока разных email. */
  function forgetExpired(currentTime: number) {
    if (currentTime - lastSweep < windowMs) return;
    lastSweep = currentTime;
    for (const [email, times] of requestsByEmail) {
      const fresh = times.filter((time) => currentTime - time < windowMs);
      if (fresh.length) requestsByEmail.set(email, fresh);
      else requestsByEmail.delete(email);
    }
  }

  return {
    tryAcquire(email) {
      const currentTime = now();
      forgetExpired(currentTime);
      const times = (requestsByEmail.get(email) ?? []).filter((time) => currentTime - time < windowMs);
      if (times.length >= max) return false;
      requestsByEmail.set(email, [...times, currentTime]);
      return true;
    },
    size: () => requestsByEmail.size,
  };
}
