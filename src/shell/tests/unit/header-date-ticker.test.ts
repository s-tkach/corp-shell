import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startMinuteAlignedTicker } from "@/components/shell/header-date-ticker";

describe("startMinuteAlignedTicker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-05T12:34:45.250Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stops ticking after cleanup even when the interval has already started", () => {
    const onTick = vi.fn();

    const cleanup = startMinuteAlignedTicker(onTick);

    vi.advanceTimersByTime(14_750);

    expect(onTick).toHaveBeenCalledTimes(1);

    cleanup();
    vi.advanceTimersByTime(180_000);

    expect(onTick).toHaveBeenCalledTimes(1);
  });

  it("does not leave the first ticker running after unmount and remount", () => {
    const firstTick = vi.fn();
    const secondTick = vi.fn();

    const cleanupFirst = startMinuteAlignedTicker(firstTick);

    vi.advanceTimersByTime(14_750);
    expect(firstTick).toHaveBeenCalledTimes(1);

    cleanupFirst();

    const cleanupSecond = startMinuteAlignedTicker(secondTick);

    vi.advanceTimersByTime(60_000);
    expect(firstTick).toHaveBeenCalledTimes(1);
    expect(secondTick).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(120_000);

    expect(firstTick).toHaveBeenCalledTimes(1);
    expect(secondTick).toHaveBeenCalledTimes(3);

    cleanupSecond();
  });
});
