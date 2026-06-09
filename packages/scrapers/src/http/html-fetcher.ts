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

export class FetchHtmlFetcher implements HtmlFetcher {
  async fetch(url: string, timeoutMs: number): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; knyhovo-scraper/1.0)',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'uk-UA,uk;q=0.9',
        },
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
