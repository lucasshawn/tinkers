import nodemailer from 'nodemailer';
import { getAllowedAdmins } from '../admin-auth';
import { loadPersistedSettings } from '../admin-save';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export interface SendAdminEmailOptions {
  to: string[];
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
}

export interface SendAdminEmailResult {
  sent: boolean;
  skipped?: boolean;
  reason?: 'missing_config' | 'no_recipients';
  messageId?: string;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function normalizeEmailList(emails: unknown[]): string[] {
  const unique = new Set<string>();
  for (const entry of emails) {
    if (typeof entry !== 'string') continue;
    const trimmed = entry.trim().toLowerCase();
    if (EMAIL_RE.test(trimmed)) {
      unique.add(trimmed);
    }
  }
  return Array.from(unique);
}

export async function resolveAdminNotificationRecipients(event?: any): Promise<string[]> {
  try {
    const settings = await loadPersistedSettings(event);
    if (Array.isArray(settings?.admins)) {
      const normalized = normalizeEmailList(settings.admins);
      if (normalized.length > 0) {
        return normalized;
      }
    }
  } catch (err) {
    console.warn('Failed to load persisted settings for admin email recipients:', err);
  }

  return normalizeEmailList(getAllowedAdmins());
}

export async function sendAdminEmail(
  options: SendAdminEmailOptions
): Promise<SendAdminEmailResult> {
  const recipients = normalizeEmailList(options.to);
  if (recipients.length === 0) {
    console.warn('Admin email skipped: no valid admin recipients configured.');
    return { sent: false, skipped: true, reason: 'no_recipients' };
  }

  const gmailUser = (process.env.GMAIL_USER || '').trim();
  const gmailAppPassword = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');

  if (!gmailUser || !gmailAppPassword) {
    console.warn(
      'Admin email skipped: GMAIL_USER and/or GMAIL_APP_PASSWORD environment variables are not set.'
    );
    return { sent: false, skipped: true, reason: 'missing_config' };
  }

  const fromName = (process.env.EMAIL_FROM_NAME || 'Weebles Studio').trim() || 'Weebles Studio';
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: gmailUser,
      pass: gmailAppPassword,
    },
  });

  const safeReplyTo =
    options.replyTo && EMAIL_RE.test(options.replyTo.trim())
      ? options.replyTo.trim()
      : undefined;

  const info = await transporter.sendMail({
    from: `"${fromName}" <${gmailUser}>`,
    to: recipients.join(', '),
    subject: options.subject,
    text: options.text,
    html: options.html,
    ...(safeReplyTo ? { replyTo: safeReplyTo } : {}),
    ...(options.attachments && options.attachments.length > 0
      ? { attachments: options.attachments }
      : {}),
  });

  return {
    sent: true,
    messageId: info?.messageId,
  };
}
