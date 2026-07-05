export function startMinuteAlignedTicker(onTick: () => void): () => void {
  let interval: ReturnType<typeof setInterval> | undefined;

  const now = new Date();
  const msUntilNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();

  const timeout = setTimeout(() => {
    onTick();
    interval = setInterval(onTick, 60_000);
  }, msUntilNextMinute);

  return () => {
    clearTimeout(timeout);
    if (interval) {
      clearInterval(interval);
    }
  };
}
