type IdleTask = {
  cancel: () => void;
};

type IdleGlobal = typeof globalThis & {
  cancelIdleCallback?: (id: number) => void;
  requestIdleCallback?: (
    callback: () => void,
    options?: { timeout?: number },
  ) => number;
};

/**
 * Schedules non-urgent work when the JS thread is idle (React Native 0.86+).
 * Prefer this over the deprecated InteractionManager.runAfterInteractions.
 */
export function scheduleIdleTask(
  callback: () => void,
  options?: { timeout?: number },
): IdleTask {
  let cancelled = false;
  const idle = globalThis as IdleGlobal;

  if (typeof idle.requestIdleCallback === "function") {
    const id = idle.requestIdleCallback(
      () => {
        if (!cancelled) {
          callback();
        }
      },
      options,
    );

    return {
      cancel: () => {
        cancelled = true;
        idle.cancelIdleCallback?.(id);
      },
    };
  }

  const timeoutId = setTimeout(() => {
    if (!cancelled) {
      callback();
    }
  }, 0);

  return {
    cancel: () => {
      cancelled = true;
      clearTimeout(timeoutId);
    },
  };
}
