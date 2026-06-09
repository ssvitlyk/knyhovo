import type { BrowserContext } from 'playwright';
import type { HtmlFetcher } from './html-fetcher.js';
import { browserManager, type BrowserManager } from './browser-manager.js';

const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Time to wait for network idle after domcontentloaded before accepting the page.
// Allows Cloudflare's JS challenge to complete and redirect to the real page.
const NETWORK_IDLE_MS = 5_000;

const BLOCKED_RESOURCE_TYPES = ['image', 'media', 'font'];

export class PlaywrightHtmlFetcher implements HtmlFetcher {
  private context: BrowserContext | null = null;

  constructor(private readonly manager: BrowserManager = browserManager) {}

  async fetch(url: string, timeoutMs: number): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`PlaywrightHtmlFetcher: timeout after ${timeoutMs}ms`)),
        timeoutMs,
      );

      this.doFetch(url, timeoutMs)
        .then((html) => {
          clearTimeout(timer);
          resolve(html);
        })
        .catch((err: unknown) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  private async doFetch(url: string, timeoutMs: number): Promise<string> {
    const browser = await this.manager.getBrowser();

    if (!this.context) {
      this.context = await browser.newContext({ userAgent: USER_AGENT, locale: 'uk-UA' });
    }

    const page = await this.context.newPage();
    try {
      await page.route('**/*', async (route) => {
        if (BLOCKED_RESOURCE_TYPES.includes(route.request().resourceType())) {
          await route.abort();
        } else {
          await route.continue();
        }
      });

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });

      // Allow Cloudflare challenge to complete; ignore if networkidle times out
      await page.waitForLoadState('networkidle', { timeout: NETWORK_IDLE_MS }).catch(() => undefined);

      return await page.content();
    } finally {
      await page.close().catch(() => undefined);
    }
  }

  async closeContext(): Promise<void> {
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
  }
}
