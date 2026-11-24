import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as adminSave from '../netlify/functions/admin-save';
import * as adminAuth from '../netlify/functions/admin-auth';
import {
  escapeHtml,
  normalizeEmailList,
  resolveAdminNotificationRecipients,
  sendAdminEmail,
} from '../netlify/functions/_lib/email';

const mockSendMail = vi.fn();
const mockCreateTransport = vi.fn((..._args: any[]) => ({
  sendMail: mockSendMail,
}));

vi.mock('nodemailer', () => ({
  default: {
    createTransport: (...args: any[]) => mockCreateTransport(...args),
  },
}));

describe('email utility', () => {
  const originalUser = process.env.GMAIL_USER;
  const originalPass = process.env.GMAIL_APP_PASSWORD;
  const originalFromName = process.env.EMAIL_FROM_NAME;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.GMAIL_USER;
    delete process.env.GMAIL_APP_PASSWORD;
    delete process.env.EMAIL_FROM_NAME;
  });

  afterEach(() => {
    if (originalUser !== undefined) process.env.GMAIL_USER = originalUser;
    else delete process.env.GMAIL_USER;
    if (originalPass !== undefined) process.env.GMAIL_APP_PASSWORD = originalPass;
    else delete process.env.GMAIL_APP_PASSWORD;
    if (originalFromName !== undefined) process.env.EMAIL_FROM_NAME = originalFromName;
    else delete process.env.EMAIL_FROM_NAME;
    vi.restoreAllMocks();
  });

  it('escapes HTML special characters safely', () => {
    expect(escapeHtml(`<script>alert("x" & 'y')</script>`)).toBe(
      '&lt;script&gt;alert(&quot;x&quot; &amp; &#39;y&#39;)&lt;/script&gt;'
    );
  });

  it('normalizes, validates, and deduplicates email lists', () => {
    expect(
      normalizeEmailList([
        '  Shawn@Example.com ',
        'shawn@example.com',
        'not-an-email',
        '',
        null,
        'cierra@example.com',
      ])
    ).toEqual(['shawn@example.com', 'cierra@example.com']);
  });

  it('resolves admin recipients from persisted settings.admins', async () => {
    vi.spyOn(adminSave, 'loadPersistedSettings').mockResolvedValue({
      admins: ['Admin1@gmail.com', 'admin2@gmail.com', 'admin1@gmail.com'],
    });

    const recipients = await resolveAdminNotificationRecipients({ headers: {} });
    expect(recipients).toEqual(['admin1@gmail.com', 'admin2@gmail.com']);
  });

  it('falls back to getAllowedAdmins when persisted settings.admins is empty', async () => {
    vi.spyOn(adminSave, 'loadPersistedSettings').mockResolvedValue({
      admins: [],
    });
    vi.spyOn(adminAuth, 'getAllowedAdmins').mockReturnValue([
      'lucasshawn@gmail.com',
      'lucascierra24@gmail.com',
    ]);

    const recipients = await resolveAdminNotificationRecipients({ headers: {} });
    expect(recipients).toEqual(['lucasshawn@gmail.com', 'lucascierra24@gmail.com']);
  });

  it('skips sending gracefully when Gmail credentials are missing', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await sendAdminEmail({
      to: ['lucasshawn@gmail.com'],
      subject: 'Test',
      text: 'Hello',
      html: '<p>Hello</p>',
    });

    expect(result).toEqual({ sent: false, skipped: true, reason: 'missing_config' });
    expect(mockCreateTransport).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('skips sending gracefully when there are no valid recipients', async () => {
    process.env.GMAIL_USER = 'weeblesclay@gmail.com';
    process.env.GMAIL_APP_PASSWORD = 'abcd efgh ijkl mnop';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await sendAdminEmail({
      to: ['invalid-email'],
      subject: 'Test',
      text: 'Hello',
      html: '<p>Hello</p>',
    });

    expect(result).toEqual({ sent: false, skipped: true, reason: 'no_recipients' });
    expect(mockCreateTransport).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('sends email via Gmail SMTP with stripped app password spaces, replyTo, and attachments', async () => {
    process.env.GMAIL_USER = 'weeblesclay@gmail.com';
    process.env.GMAIL_APP_PASSWORD = 'abcd efgh ijkl mnop';
    mockSendMail.mockResolvedValue({ messageId: '<msg-123@gmail.com>' });

    const attachmentBuffer = Buffer.from('fake-png-bytes');
    const result = await sendAdminEmail({
      to: ['lucasshawn@gmail.com', 'lucascierra24@gmail.com'],
      subject: 'New Order!',
      text: 'Order details',
      html: '<p>Order details</p>',
      replyTo: 'buyer@example.com',
      attachments: [
        {
          filename: 'ref.png',
          content: attachmentBuffer,
          contentType: 'image/png',
        },
      ],
    });

    expect(mockCreateTransport).toHaveBeenCalledWith({
      service: 'gmail',
      auth: {
        user: 'weeblesclay@gmail.com',
        pass: 'abcdefghijklmnop',
      },
    });
    expect(mockSendMail).toHaveBeenCalledWith({
      from: '"Weebles Studio" <weeblesclay@gmail.com>',
      to: 'lucasshawn@gmail.com, lucascierra24@gmail.com',
      subject: 'New Order!',
      text: 'Order details',
      html: '<p>Order details</p>',
      replyTo: 'buyer@example.com',
      attachments: [
        {
          filename: 'ref.png',
          content: attachmentBuffer,
          contentType: 'image/png',
        },
      ],
    });
    expect(result).toEqual({ sent: true, messageId: '<msg-123@gmail.com>' });
  });
});
