/** Bound each independent read; a late response cannot replace a timed-out query. */
export async function detailDeadline<T>(read: () => PromiseLike<T>, milliseconds = 15_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(read),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('讀取暫未完成，請重試')), milliseconds); }),
    ]);
  } finally { clearTimeout(timer); }
}