import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('logError', () => {
  let originalConsoleError;

  beforeEach(() => {
    originalConsoleError = console.error;
    console.error = vi.fn();
    // Reset module cache so import.meta.env.DEV is re-evaluated
    vi.resetModules();
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  it('calls console.error in dev mode', async () => {
    // Vite test environment defaults to DEV=true
    const { logError } = await import('../lib/logger');
    logError('test msg', new Error('boom'));
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith('test msg', expect.any(Error));
  });

  it('does not call console.error in production mode', async () => {
    // Override import.meta.env.DEV for this test
    const origDev = import.meta.env.DEV;
    import.meta.env.DEV = false;
    try {
      const { logError } = await import('../lib/logger');
      logError('test msg', new Error('boom'));
      expect(console.error).not.toHaveBeenCalled();
    } finally {
      import.meta.env.DEV = origDev;
    }
  });
});
