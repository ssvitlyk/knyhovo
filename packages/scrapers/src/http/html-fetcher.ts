/**
 * Minimal HTTP abstraction for fetching raw HTML.
 * Injectable so tests can substitute fixture-based implementations
 * without touching the network.
 *
 * NOTE: Yakaboo is protected by Cloudflare and requires a browser context
 * (Playwright) to bypass the JS challenge in production. The default
 * FetchHtmlFetcher uses native fetch and will be blocked by Cloudflare on
 * live Yakaboo URLs. Replace it with a Playwright-based fetcher for prod.
 */
export interface HtmlFetcher {
  fetch(url: string, timeoutMs: number): Promise<string>;
}

/** Realistic desktop-Chrome request headers; merged under any caller overrides. */
const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept':
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'uk-UA,uk;q=0.9,ru;q=0.8,en;q=0.7',
};

export class FetchHtmlFetcher implements HtmlFetcher {
  private readonly headers: Record<string, string>;

  /**
   * @param headers Optional header overrides. Caller-supplied values win; the
   *   realistic browser defaults below fill in anything missing — a bot-shaped
   *   User-Agent is an easy anti-bot signal that some providers 403 outright.
   */
  constructor(headers: Record<string, string> = {}) {
    this.headers = { ...DEFAULT_HEADERS, ...headers };
  }

  async fetch(url: string, timeoutMs: number): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: this.headers,
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      return await response.text();
    } finally {
      clearTimeout(timer);
    }
  }
}
