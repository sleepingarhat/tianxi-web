/** Bound the view's wait without changing the underlying historical calculation. */
export async function featureReadDeadline<T>(read: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([read, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("特徵資料仍未讀齊，請重新讀取。")), 90_000);
    })]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}