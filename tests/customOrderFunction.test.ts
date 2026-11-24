import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handler } from '../netlify/functions/custom-order';
import * as emailLib from '../netlify/functions/_lib/email';

describe('custom-order Netlify Function', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(emailLib, 'resolveAdminNotificationRecipients').mockResolvedValue([
      'lucasshawn@gmail.com',
      'lucascierra24@gmail.com',
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 405 for non-POST requests', async () => {
    const res = (await handler({ httpMethod: 'GET', headers: {} } as any, {} as any, () => {})) as any;
    expect(res.statusCode).toBe(405);
  });

  it('returns 400 for malformed JSON body', async () => {
    const res = (await handler(
      { httpMethod: 'POST', headers: {}, body: '{not-json' } as any,
      {} as any,
      () => {}
    )) as any;
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when required fields are missing or email is invalid', async () => {
    const missingRes = (await handler(
      {
        httpMethod: 'POST',
        headers: {},
        body: JSON.stringify({ name: 'Sophie', email: 'sophie@example.com' }),
      } as any,
      {} as any,
      () => {}
    )) as any;
    expect(missingRes.statusCode).toBe(400);

    const badEmailRes = (await handler(
      {
        httpMethod: 'POST',
        headers: {},
        body: JSON.stringify({
          name: 'Sophie',
          email: 'not-an-email',
          finish: 'magnet',
          description: 'Cute bunny',
        }),
      } as any,
      {} as any,
      () => {}
    )) as any;
    expect(badEmailRes.statusCode).toBe(400);
  });

  it('rejects unsupported image MIME types and attachments over 4 MB', async () => {
    const badMimeRes = (await handler(
      {
        httpMethod: 'POST',
        headers: {},
        body: JSON.stringify({
          name: 'Sophie',
          email: 'sophie@example.com',
          finish: 'magnet',
          description: 'Cute bunny',
          referencePhoto: {
            filename: 'evil.svg',
            contentType: 'image/svg+xml',
            base64: Buffer.from('<svg></svg>').toString('base64'),
          },
        }),
      } as any,
      {} as any,
      () => {}
    )) as any;
    expect(badMimeRes.statusCode).toBe(400);

    const oversizedBuffer = Buffer.alloc(4 * 1024 * 1024 + 10, 1);
    const bigRes = (await handler(
      {
        httpMethod: 'POST',
        headers: {},
        body: JSON.stringify({
          name: 'Sophie',
          email: 'sophie@example.com',
          finish: 'magnet',
          description: 'Cute bunny',
          referencePhoto: {
            filename: 'huge.png',
            contentType: 'image/png',
            base64: oversizedBuffer.toString('base64'),
          },
        }),
      } as any,
      {} as any,
      () => {}
    )) as any;
    expect(bigRes.statusCode).toBe(400);
  });

  it('emails all admins with escaped HTML, replyTo, and reference photo attachment', async () => {
    const sendSpy = vi
      .spyOn(emailLib, 'sendAdminEmail')
      .mockResolvedValue({ sent: true, messageId: '<custom-1@gmail.com>' });

    const photoBytes = Buffer.from('png-photo-bytes');
    const res = (await handler(
      {
        httpMethod: 'POST',
        headers: {},
        body: JSON.stringify({
          name: 'Sophie',
          email: 'sophie@example.com',
          finish: 'keychain',
          description: 'Pink piggy with <bow> & sprinkles',
          referencePhoto: {
            filename: '../my piggy!.png',
            contentType: 'image/png',
            base64: photoBytes.toString('base64'),
          },
        }),
      } as any,
      {} as any,
      () => {}
    )) as any;

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ ok: true, emailed: true });
    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ['lucasshawn@gmail.com', 'lucascierra24@gmail.com'],
        subject: 'New Custom Weeble Request from Sophie (Keychain)',
        replyTo: 'sophie@example.com',
        attachments: [
          {
            filename: 'my_piggy_.png',
            content: photoBytes,
            contentType: 'image/png',
          },
        ],
      })
    );
    const callArg = sendSpy.mock.calls[0][0];
    expect(callArg.html).toContain('Pink piggy with &lt;bow&gt; &amp; sprinkles');
    expect(callArg.html).not.toContain('<bow>');
  });

  it('returns 500 if SMTP sending fails', async () => {
    vi.spyOn(emailLib, 'sendAdminEmail').mockRejectedValue(new Error('Gmail auth failed'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = (await handler(
      {
        httpMethod: 'POST',
        headers: {},
        body: JSON.stringify({
          name: 'Sophie',
          email: 'sophie@example.com',
          finish: 'figurine',
          description: 'A sleepy cat',
        }),
      } as any,
      {} as any,
      () => {}
    )) as any;

    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body).error).toBe('Gmail auth failed');
    errorSpy.mockRestore();
  });
});
