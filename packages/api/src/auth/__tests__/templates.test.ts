import { describe, it, expect } from 'vitest';
import { renderMagicLinkEmail, renderLoginCodeEmail } from '../templates.js';

describe('renderMagicLinkEmail', () => {
  const url = 'https://knyhovo.com/auth/verify?token=abc123';

  it('includes the clickable link in both html and text', () => {
    const email = renderMagicLinkEmail({ url });
    expect(email.subject).toContain('Knyhovo');
    expect(email.html).toContain(`href="${url}"`);
    expect(email.text).toContain(url);
  });

  it('escapes HTML-special characters in the URL inside the html body', () => {
    const email = renderMagicLinkEmail({ url: 'https://x/verify?token=a&b<c' });
    expect(email.html).toContain('&amp;');
    expect(email.html).toContain('&lt;');
    expect(email.html).not.toContain('a&b<c');
    // Plain-text body keeps the raw URL.
    expect(email.text).toContain('a&b<c');
  });

  it('carries a single-use / expiry security note', () => {
    const email = renderMagicLinkEmail({ url });
    expect(email.text).toContain('один раз');
  });
});

describe('renderLoginCodeEmail', () => {
  it('includes the OTP code in subject, html and text', () => {
    const email = renderLoginCodeEmail({ code: '123456' });
    expect(email.subject).toContain('123456');
    expect(email.html).toContain('123456');
    expect(email.text).toContain('123456');
  });
});
