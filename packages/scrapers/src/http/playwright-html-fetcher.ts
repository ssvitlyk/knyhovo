import type { BrowserContext } from 'playwright';
import type { HtmlFetcher } from './html-fetcher.js';
import { browserManager, type BrowserManager } from './browser-manager.js';

const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Time to wait for network idle after domcontentloaded before accepting the page.
// Allows Cloudflare's JS challenge to complete and redirect to the real page.
const NETWORK_IDLE_MS = 5_000;

// Max time to wait for the content selector to appear (see waitForSelector option).
// A JS challenge (e.g. Cloudflare Managed Challenge) can take a few seconds to
// solve and redirect; networkidle alone fires on the lightweight challenge page
// far too early, so content-aware sites wait for a real element instead.
const CONTENT_WAIT_MS = 15_000;

const BLOCKED_RESOURCE_TYPES = ['image', 'media', 'font'];

/** Optional tuning for {@link PlaywrightHtmlFetcher}. */
export interface PlaywrightFetchOptions {
  /**
   * CSS selector that only exists once the real page content has rendered.
   * When set, the fetcher waits for this selector to appear before reading the
   * HTML — giving a JS challenge time to solve and redirect to the actual page.
   * Falls back gracefully: if the selector never appears within the wait window,
   * whatever content is present is returned anyway (errors surface downstream as
   * "no listings" rather than throwing). When omitted, behaviour is unchanged:
   * the fetcher waits for networkidle only.
   */
  readonly waitForSelector?: string;
  /**
   * CSS selector that marks an anti-bot challenge interstitial (e.g. a Cloudflare
   * Turnstile iframe). When set alongside {@link waitForSelector}, the fetcher
   * waits for *either* the real content OR a challenge marker — whichever renders
   * first — so a persistent challenge is detected promptly instead of burning the
   * full content-wait budget. Detection only: the challenge is never solved or
   * bypassed; downstream code classifies the returned HTML and reports the block.
   */
  readonly challengeSelector?: string;
}

export class PlaywrightHtmlFetcher implements HtmlFetcher {
  private context: BrowserContext | null = null;

  constructor(
    private readonly manager: BrowserManager = browserManager,
    private readonly options: PlaywrightFetchOptions = {},
  ) {}

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
      // Block only heavy static assets. Scripts, XHR/fetch, documents and frames
      // are always allowed through — a Cloudflare challenge needs its own
      // scripts/frames to run, so aborting them would stall the challenge rather
      // than let it solve.
      await page.route('**/*', async (route) => {
        if (BLOCKED_RESOURCE_TYPES.includes(route.request().resourceType())) {
          await route.abort();
        } else {
          await route.continue();
        }
      });

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });

      const { waitForSelector, challengeSelector } = this.options;
      if (waitForSelector) {
        // Content-aware wait: hold until the real page element renders so a JS
        // challenge has time to solve and redirect. When a challengeSelector is
        // configured, resolve as soon as EITHER the content or a challenge marker
        // appears. Ignore the timeout — return whatever loaded (degrades to "no
        // listings"/an explicit blocked-page error downstream, never throws here).
        const waitMs = Math.min(CONTENT_WAIT_MS, timeoutMs);
        const selectors = challengeSelector
          ? [waitForSelector, challengeSelector]
          : [waitForSelector];
        await Promise.race(
          selectors.map((selector) => page.waitForSelector(selector, { timeout: waitMs })),
        ).catch(() => undefined);
      } else {
        // Allow Cloudflare challenge to complete; ignore if networkidle times out
        await page
          .waitForLoadState('networkidle', { timeout: NETWORK_IDLE_MS })
          .catch(() => undefined);
      }

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
