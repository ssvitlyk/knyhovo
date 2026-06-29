import { describe, it, expect, vi } from 'vitest';
import {
  ConsoleAlertMailer,
  ResendAlertMailer,
  type EmailSendClient,
  type AlertEmailPayload,
} from '../mailer.js';

const payload: AlertEmailPayload = {
  to: 'reader@example.com',
  subject: 'Subject',
  html: '<p>hi</p>',
  text: 'hi',
  unsubscribeUrl: 'https://knyhovo.com/api/notifications/unsubscribe?token=t',
};

describe('ConsoleAlertMailer', () => {
  it('returns ok without sending real mail', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const res = await new ConsoleAlertMailer().sendAlertEmail(payload);
    expect(res).toEqual({ ok: true, messageId: null });
    spy.mockRestore();
  });
});

function makeClient(
  impl: EmailSendClient['emails']['send'],
): { client: EmailSendClient; send: ReturnType<typeof vi.fn> } {
  const send = vi.fn(impl);
  return { client: { emails: { send } }, send };
}

describe('ResendAlertMailer', () => {
  it('returns messageId and passes List-Unsubscribe header on success', async () => {
    const { client, send } = makeClient(async () => ({ data: { id: 'msg-1' }, error: null }));
    const res = await new ResendAlertMailer(client, 'alerts@knyhovo.com').sendAlertEmail(payload);
    expect(res).toEqual({ ok: true, messageId: 'msg-1' });
    expect(send.mock.calls[0]?.[0]).toMatchObject({
      from: 'alerts@knyhovo.com',
      to: 'reader@example.com',
      headers: { 'List-Unsubscribe': `<${payload.unsubscribeUrl}>` },
    });
  });

  it('classifies rate-limit errors as retryable', async () => {
    const { client } = makeClient(async () => ({
      data: null,
      error: { message: 'too many requests', name: 'rate_limit_exceeded' },
    }));
    const res = await new ResendAlertMailer(client, 'a@b.com').sendAlertEmail(payload);
    expect(res).toEqual({ ok: false, retryable: true, error: 'too many requests' });
  });

  it('classifies validation errors as non-retryable', async () => {
    const { client } = makeClient(async () => ({
      data: null,
      error: { message: 'invalid recipient', name: 'validation_error' },
    }));
    const res = await new ResendAlertMailer(client, 'a@b.com').sendAlertEmail(payload);
    expect(res).toEqual({ ok: false, retryable: false, error: 'invalid recipient' });
  });

  it('treats thrown errors as retryable', async () => {
    const { client } = makeClient(async () => {
      throw new Error('socket hang up');
    });
    const res = await new ResendAlertMailer(client, 'a@b.com').sendAlertEmail(payload);
    expect(res).toEqual({ ok: false, retryable: true, error: 'socket hang up' });
  });
});
