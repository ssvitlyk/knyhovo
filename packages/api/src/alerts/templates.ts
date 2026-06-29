/**
 * Alert email templates (W4b). Pure render functions returning { subject, html,
 * text } — no I/O, fully deterministic and unit-testable. UA copy for v1.
 */

import type { Provider } from '@prisma/client';

export interface AlertTemplateData {
  readonly bookTitle: string;
  readonly bookAuthor: string;
  /** Lowest in-stock price (копійки) being advertised. */
  readonly priceAmount: number;
  /** User's target price (копійки) — shown for price-drop emails. */
  readonly targetPriceAmount: number;
  readonly provider: Provider;
  /** Direct link to the cheapest in-stock listing. */
  readonly url: string;
  /** One-click unsubscribe link. */
  readonly unsubscribeUrl: string;
}

export interface RenderedEmail {
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}

const PROVIDER_LABELS: Record<Provider, string> = {
  YAKABOO: 'Yakaboo',
  BOOK_CLUB: 'КСД (BookClub)',
  VIVAT: 'Vivat',
  BOOK_YE: 'Книгарня Є',
  BOOKCHEF: 'BookChef',
  LABORATORY: 'Лабораторія',
  KNIGOLAND: 'Knigoland',
};

export function providerLabel(provider: Provider): string {
  return PROVIDER_LABELS[provider] ?? provider;
}

/** Format копійки as a UAH string, e.g. 34999 → "349,99 ₴". */
export function formatUah(amount: number): string {
  const hryvnia = Math.floor(amount / 100);
  const kopecks = Math.abs(amount % 100);
  return `${hryvnia},${kopecks.toString().padStart(2, '0')} ₴`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function footer(unsubscribeUrl: string): { html: string; text: string } {
  return {
    html: `<hr/><p style="color:#888;font-size:12px">Ви отримали цей лист, бо додали книгу до wishlist на Knyhovo. <a href="${escapeHtml(unsubscribeUrl)}">Відписатися</a>.</p>`,
    text: `\n\nВи отримали цей лист, бо додали книгу до wishlist на Knyhovo. Відписатися: ${unsubscribeUrl}`,
  };
}

export function renderPriceDropEmail(data: AlertTemplateData): RenderedEmail {
  const title = escapeHtml(data.bookTitle);
  const author = escapeHtml(data.bookAuthor);
  const price = formatUah(data.priceAmount);
  const target = formatUah(data.targetPriceAmount);
  const label = providerLabel(data.provider);
  const f = footer(data.unsubscribeUrl);

  const subject = `Ціна знизилась: «${data.bookTitle}» — ${price}`;
  const html =
    `<h2>Ціна на книгу з вашого wishlist знизилась</h2>` +
    `<p><strong>${title}</strong><br/>${author}</p>` +
    `<p>Нова ціна: <strong>${price}</strong> (ваша цільова: ${target})<br/>Продавець: ${escapeHtml(label)}</p>` +
    `<p><a href="${escapeHtml(data.url)}">Перейти до книги</a></p>` +
    f.html;
  const text =
    `Ціна на книгу з вашого wishlist знизилась.\n\n` +
    `${data.bookTitle} — ${data.bookAuthor}\n` +
    `Нова ціна: ${price} (ваша цільова: ${target})\n` +
    `Продавець: ${label}\n` +
    `${data.url}` +
    f.text;
  return { subject, html, text };
}

export function renderBackInStockEmail(data: AlertTemplateData): RenderedEmail {
  const title = escapeHtml(data.bookTitle);
  const author = escapeHtml(data.bookAuthor);
  const price = formatUah(data.priceAmount);
  const label = providerLabel(data.provider);
  const f = footer(data.unsubscribeUrl);

  const subject = `Знову в наявності: «${data.bookTitle}»`;
  const html =
    `<h2>Книга з вашого wishlist знову в наявності</h2>` +
    `<p><strong>${title}</strong><br/>${author}</p>` +
    `<p>Ціна: <strong>${price}</strong><br/>Продавець: ${escapeHtml(label)}</p>` +
    `<p><a href="${escapeHtml(data.url)}">Перейти до книги</a></p>` +
    f.html;
  const text =
    `Книга з вашого wishlist знову в наявності.\n\n` +
    `${data.bookTitle} — ${data.bookAuthor}\n` +
    `Ціна: ${price}\n` +
    `Продавець: ${label}\n` +
    `${data.url}` +
    f.text;
  return { subject, html, text };
}
