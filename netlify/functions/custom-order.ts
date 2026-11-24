import { Handler } from '@netlify/functions';
import path from 'path';
import {
  EmailAttachment,
  escapeHtml,
  resolveAdminNotificationRecipients,
  sendAdminEmail,
} from './_lib/email';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_IMAGE_MIME_RE = /^image\/(png|jpe?g|webp|gif)$/i;
const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024; // 4 MB

const FINISH_LABELS: Record<string, string> = {
  magnet: 'Magnet',
  keychain: 'Keychain',
  figurine: 'Figurine',
};

interface ReferencePhotoPayload {
  filename?: string;
  contentType?: string;
  base64?: string;
}

interface CustomOrderBody {
  name?: string;
  email?: string;
  finish?: string;
  description?: string;
  referencePhoto?: ReferencePhotoPayload | null;
}

function sanitizeFilename(rawName?: string, contentType = 'image/jpeg'): string {
  const extFromMime = contentType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
  const base = path.basename((rawName || '').trim()).replace(/[^a-zA-Z0-9._-]/g, '_');
  if (!base || base === '.' || base === '..') {
    return `reference-photo.${extFromMime}`;
  }
  return base.slice(0, 100);
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  let body: CustomOrderBody;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid JSON request body' }),
    };
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const finishRaw = typeof body.finish === 'string' ? body.finish.trim().toLowerCase() : 'magnet';
  const description = typeof body.description === 'string' ? body.description.trim() : '';

  if (!name || !email || !description) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Name, email, and description are required' }),
    };
  }

  if (!EMAIL_RE.test(email)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Please provide a valid email address' }),
    };
  }

  const finishLabel = FINISH_LABELS[finishRaw] || (finishRaw ? finishRaw.slice(0, 40) : 'Magnet');
  const attachments: EmailAttachment[] = [];

  if (body.referencePhoto) {
    const { filename, contentType, base64 } = body.referencePhoto;
    if (!contentType || !ALLOWED_IMAGE_MIME_RE.test(contentType)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Reference photo must be a PNG, JPG, WEBP, or GIF image',
        }),
      };
    }

    if (typeof base64 !== 'string' || !base64.trim()) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid reference photo data' }),
      };
    }

    const strippedBase64 = base64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '').trim();
    const buffer = Buffer.from(strippedBase64, 'base64');
    if (buffer.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid reference photo data' }),
      };
    }

    if (buffer.length > MAX_ATTACHMENT_BYTES) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Reference photo must be 4 MB or smaller' }),
      };
    }

    attachments.push({
      filename: sanitizeFilename(filename, contentType),
      content: buffer,
      contentType: contentType.toLowerCase(),
    });
  }

  const textLines = [
    'New Custom Weeble Request!',
    '',
    `Customer Name: ${name}`,
    `Customer Email: ${email}`,
    `Preferred Finish: ${finishLabel}`,
    '',
    'Vision / Description:',
    description,
    '',
    attachments.length > 0
      ? `Reference Photo: Attached (${attachments[0].filename})`
      : 'Reference Photo: None attached',
    '',
    'Reply directly to this email to send a quote and timeline to the customer.',
  ];

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#3b2c35;">
      <div style="background:#fdf2f8;border:2px solid #fbcfe8;border-radius:16px;padding:24px;">
        <h2 style="margin:0 0 8px;color:#ec4899;">New Custom Weeble Request!</h2>
        <p style="margin:0 0 16px;font-size:14px;">Reply directly to this email to send a quote to <strong>${escapeHtml(name)}</strong>.</p>
        <div style="background:#ffffff;border-radius:12px;padding:16px;margin-bottom:16px;border:1px solid #fce7f3;">
          <p style="margin:4px 0;font-size:14px;"><strong>Name:</strong> ${escapeHtml(name)}</p>
          <p style="margin:4px 0;font-size:14px;"><strong>Email:</strong> ${escapeHtml(email)}</p>
          <p style="margin:4px 0;font-size:14px;"><strong>Preferred Finish:</strong> ${escapeHtml(finishLabel)}</p>
          <p style="margin:4px 0;font-size:14px;"><strong>Reference Photo:</strong> ${
            attachments.length > 0
              ? `Attached (${escapeHtml(attachments[0].filename)})`
              : 'None'
          }</p>
        </div>
        <div style="background:#ffffff;border-left:4px solid #ec4899;border-radius:8px;padding:14px;font-size:14px;line-height:1.5;">
          <strong>Customer Vision:</strong><br/>
          ${escapeHtml(description).replace(/\n/g, '<br/>')}
        </div>
      </div>
    </div>
  `;

  try {
    const recipients = await resolveAdminNotificationRecipients(event);
    const emailResult = await sendAdminEmail({
      to: recipients,
      subject: `New Custom Weeble Request from ${name} (${finishLabel})`,
      text: textLines.join('\n'),
      html,
      replyTo: email,
      attachments,
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, emailed: emailResult.sent }),
    };
  } catch (err: any) {
    console.error('Failed to send custom order notification email:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: err?.message || 'Unable to send custom order request right now',
      }),
    };
  }
};
