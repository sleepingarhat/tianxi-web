/** Display-only references must not hold up mandatory evidence verification. */
export async function optionalRacingReference<T>(read: (signal: AbortSignal) => Promise<T>, timeoutMs = 3_000): Promise<T | null> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<null>(resolve => {
    timer = setTimeout(() => { controller.abort(); resolve(null); }, timeoutMs);
  });
  try {
    return await Promise.race([Promise.resolve().then(() => read(controller.signal)).catch(() => null), deadline]);
  } finally {
    clearTimeout(timer);
  }
}