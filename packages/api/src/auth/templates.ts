/**
 * Auth email templates. Pure render functions returning { subject, html, text }
 * — no I/O, deterministic and unit-testable. UA copy for v1. Mirrors the style
 * of `alerts/templates.ts`.
 */

export interface RenderedEmail {
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const SECURITY_NOTE =
  'Посилання діє обмежений час і працює один раз. Якщо ви не намагалися увійти — просто проігноруйте цей лист.';

/** Magic-link login email — the primary web auth flow. */
export function renderMagicLinkEmail(data: { url: string }): RenderedEmail {
  const url = escapeHtml(data.url);
  const subject = 'Ваше посилання для входу — Knyhovo';
  const html =
    `<h2>Вхід у Knyhovo</h2>` +
    `<p>Натисніть кнопку нижче, щоб увійти у свій акаунт:</p>` +
    `<p><a href="${url}">Увійти в Knyhovo</a></p>` +
    `<hr/><p style="color:#888;font-size:12px">${SECURITY_NOTE}</p>`;
  const text =
    `Вхід у Knyhovo\n\n` +
    `Відкрийте посилання, щоб увійти:\n${data.url}\n\n` +
    SECURITY_NOTE;
  return { subject, html, text };
}

/** OTP code email — legacy/dev fallback flow (`/api/auth/request-code`). */
export function renderLoginCodeEmail(data: { code: string }): RenderedEmail {
  const code = escapeHtml(data.code);
  const subject = `Ваш код для входу: ${data.code} — Knyhovo`;
  const html =
    `<h2>Вхід у Knyhovo</h2>` +
    `<p>Ваш одноразовий код для входу:</p>` +
    `<p style="font-size:24px;font-weight:700;letter-spacing:4px">${code}</p>` +
    `<hr/><p style="color:#888;font-size:12px">${SECURITY_NOTE}</p>`;
  const text =
    `Вхід у Knyhovo\n\n` +
    `Ваш одноразовий код для входу: ${data.code}\n\n` +
    SECURITY_NOTE;
  return { subject, html, text };
}
