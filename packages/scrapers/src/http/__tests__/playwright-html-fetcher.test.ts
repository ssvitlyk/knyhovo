import { describe, it, expect, vi, beforeEach } from 'vitest';
import { chromium } from 'playwright';
import { PlaywrightHtmlFetcher } from '../playwright-html-fetcher.js';
import { BrowserManager } from '../browser-manager.js';

// vi.hoisted ensures these objects exist before vi.mock() hoisting runs.
const mocks = vi.hoisted(() => {
  const mockPage = {
    goto: vi.fn().mockResolvedValue(undefined),
    waitForLoadState: vi.fn().mockResolvedValue(undefined),
    content: vi.fn().mockResolvedValue('<html><body>page content</body></html>'),
    close: vi.fn().mockResolvedValue(undefined),
    route: vi.fn().mockResolvedValue(undefined),
    waitForSelector: vi.fn().mockResolvedValue(undefined),
  };
  const mockContext = {
    newPage: vi.fn().mockResolvedValue(mockPage),
    close: vi.fn().mockResolvedValue(undefined),
  };
  const mockBrowser = {
    newContext: vi.fn().mockResolvedValue(mockContext),
    isConnected: vi.fn().mockReturnValue(true),
    close: vi.fn().mockResolvedValue(undefined),
  };
  return { mockPage, mockContext, mockBrowser };
});

vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn().mockResolvedValue(mocks.mockBrowser),
  },
}));

// Re-apply all default implementations after each reset.
function applyDefaultMocks() {
  mocks.mockPage.goto.mockResolvedValue(undefined);
  mocks.mockPage.waitForLoadState.mockResolvedValue(undefined);
  mocks.mockPage.content.mockResolvedValue('<html><body>page content</body></html>');
  mocks.mockPage.close.mockResolvedValue(undefined);
  mocks.mockPage.route.mockResolvedValue(undefined);
  mocks.mockPage.waitForSelector.mockResolvedValue(undefined);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mocks.mockContext.newPage.mockResolvedValue(mocks.mockPage as any);
  mocks.mockContext.close.mockResolvedValue(undefined);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mocks.mockBrowser.newContext.mockResolvedValue(mocks.mockContext as any);
  mocks.mockBrowser.isConnected.mockReturnValue(true);
  mocks.mockBrowser.close.mockResolvedValue(undefined);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(chromium.launch).mockResolvedValue(mocks.mockBrowser as any);
}

describe('BrowserManager', () => {
  let manager: BrowserManager;

  beforeEach(() => {
    vi.resetAllMocks(); // clears call history, once-queues, and implementations
    applyDefaultMocks();
    manager = new BrowserManager();
  });

  it('launches browser on first getBrowser() call', async () => {
    await manager.getBrowser();
    expect(chromium.launch).toHaveBeenCalledTimes(1);
    expect(chromium.launch).toHaveBeenCalledWith({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
  });

  it('reuses the same browser on subsequent getBrowser() calls', async () => {
    await manager.getBrowser();
    await manager.getBrowser();
    expect(chromium.launch).toHaveBeenCalledTimes(1);
  });

  it('relaunches browser when previous instance has disconnected', async () => {
    // isConnected() is only checked on the 2nd call (when browser is already set)
    mocks.mockBrowser.isConnected.mockReturnValueOnce(false);
    await manager.getBrowser(); // browser = null → launches; isConnected not called
    await manager.getBrowser(); // isConnected() → false → relaunches
    expect(chromium.launch).toHaveBeenCalledTimes(2);
  });

  it('close() closes the browser', async () => {
    await manager.getBrowser();
    await manager.close();
    expect(mocks.mockBrowser.close).toHaveBeenCalledTimes(1);
  });

  it('close() is a no-op when browser was never launched', async () => {
    await expect(manager.close()).resolves.toBeUndefined();
    expect(mocks.mockBrowser.close).not.toHaveBeenCalled();
  });
});

describe('PlaywrightHtmlFetcher', () => {
  let manager: BrowserManager;

  beforeEach(() => {
    vi.resetAllMocks(); // clears call history, once-queues, and implementations
    applyDefaultMocks();
    manager = new BrowserManager();
  });

  it('returns page HTML from page.content()', async () => {
    const fetcher = new PlaywrightHtmlFetcher(manager);
    const html = await fetcher.fetch('https://example.com', 10_000);
    expect(html).toBe('<html><body>page content</body></html>');
  });

  it('launches browser only once across multiple fetch() calls', async () => {
    const fetcher = new PlaywrightHtmlFetcher(manager);
    await fetcher.fetch('https://a.com', 10_000);
    await fetcher.fetch('https://b.com', 10_000);
    expect(chromium.launch).toHaveBeenCalledTimes(1);
  });

  it('creates one context per fetcher instance', async () => {
    const fetcher = new PlaywrightHtmlFetcher(manager);
    await fetcher.fetch('https://a.com', 10_000);
    await fetcher.fetch('https://b.com', 10_000);
    expect(mocks.mockBrowser.newContext).toHaveBeenCalledTimes(1);
  });

  it('creates a new page per fetch() call', async () => {
    const fetcher = new PlaywrightHtmlFetcher(manager);
    await fetcher.fetch('https://a.com', 10_000);
    await fetcher.fetch('https://b.com', 10_000);
    expect(mocks.mockContext.newPage).toHaveBeenCalledTimes(2);
  });

  it('closes the page after each fetch()', async () => {
    const fetcher = new PlaywrightHtmlFetcher(manager);
    await fetcher.fetch('https://example.com', 10_000);
    expect(mocks.mockPage.close).toHaveBeenCalledTimes(1);
  });

  it('closes the page even when page.goto() throws', async () => {
    mocks.mockPage.goto.mockRejectedValue(new Error('Navigation failed'));
    const fetcher = new PlaywrightHtmlFetcher(manager);
    await expect(fetcher.fetch('https://example.com', 10_000)).rejects.toThrow('Navigation failed');
    expect(mocks.mockPage.close).toHaveBeenCalledTimes(1);
  });

  it('throws when fetch() times out', async () => {
    vi.useFakeTimers();
    mocks.mockPage.goto.mockReturnValue(new Promise<void>(() => undefined)); // never resolves

    const fetcher = new PlaywrightHtmlFetcher(manager);
    const fetchPromise = fetcher.fetch('https://example.com', 30_000);
    // Attach early handler to avoid "PromiseRejectionHandledWarning" from Node.js
    const handledPromise = fetchPromise.catch(() => undefined);

    await vi.advanceTimersByTimeAsync(30_000);
    await handledPromise;

    await expect(fetchPromise).rejects.toThrow(/timeout/i);

    vi.useRealTimers();
  });

  it('calls page.goto with domcontentloaded', async () => {
    const fetcher = new PlaywrightHtmlFetcher(manager);
    await fetcher.fetch('https://example.com', 10_000);
    expect(mocks.mockPage.goto).toHaveBeenCalledWith('https://example.com', {
      waitUntil: 'domcontentloaded',
      timeout: 10_000,
    });
  });

  it('waits for networkidle to allow Cloudflare challenge to resolve', async () => {
    const fetcher = new PlaywrightHtmlFetcher(manager);
    await fetcher.fetch('https://example.com', 10_000);
    expect(mocks.mockPage.waitForLoadState).toHaveBeenCalledWith(
      'networkidle',
      expect.objectContaining({ timeout: expect.any(Number) }),
    );
  });

  it('succeeds even when networkidle times out', async () => {
    mocks.mockPage.waitForLoadState.mockRejectedValue(new Error('networkidle timeout'));
    const fetcher = new PlaywrightHtmlFetcher(manager);
    await expect(fetcher.fetch('https://example.com', 10_000)).resolves.toBe(
      '<html><body>page content</body></html>',
    );
  });

  it('waits for the content selector instead of networkidle when configured', async () => {
    const fetcher = new PlaywrightHtmlFetcher(manager, { waitForSelector: 'a.product-item-link' });
    await fetcher.fetch('https://example.com', 30_000);
    expect(mocks.mockPage.waitForSelector).toHaveBeenCalledWith(
      'a.product-item-link',
      expect.objectContaining({ timeout: expect.any(Number) }),
    );
    expect(mocks.mockPage.waitForLoadState).not.toHaveBeenCalled();
  });

  it('still returns content when the content selector never appears', async () => {
    mocks.mockPage.waitForSelector.mockRejectedValue(new Error('selector timeout'));
    const fetcher = new PlaywrightHtmlFetcher(manager, { waitForSelector: 'a.product-item-link' });
    await expect(fetcher.fetch('https://example.com', 30_000)).resolves.toBe(
      '<html><body>page content</body></html>',
    );
  });

  it('does not call waitForSelector when no selector is configured', async () => {
    const fetcher = new PlaywrightHtmlFetcher(manager);
    await fetcher.fetch('https://example.com', 10_000);
    expect(mocks.mockPage.waitForSelector).not.toHaveBeenCalled();
  });

  it('closeContext() closes the browser context', async () => {
    const fetcher = new PlaywrightHtmlFetcher(manager);
    await fetcher.fetch('https://example.com', 10_000);
    await fetcher.closeContext();
    expect(mocks.mockContext.close).toHaveBeenCalledTimes(1);
  });

  it('closeContext() is a no-op before first fetch()', async () => {
    const fetcher = new PlaywrightHtmlFetcher(manager);
    await expect(fetcher.closeContext()).resolves.toBeUndefined();
    expect(mocks.mockContext.close).not.toHaveBeenCalled();
  });
});
