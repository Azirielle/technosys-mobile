export async function withTimeout<T = any>(promise: any, ms = 4000): Promise<T> {
  let timeoutId: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('Network request timed out. Loading offline data.'));
    }, ms);
  });

  return Promise.race([
    Promise.resolve(promise).then((res) => {
      clearTimeout(timeoutId);
      return res;
    }),
    timeoutPromise
  ]) as any;
}
