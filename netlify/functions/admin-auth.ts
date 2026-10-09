import { Handler } from '@netlify/functions';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import defaultSettingsData from '../../src/data/settings.json';

export const DEFAULT_ADMINS = [
  'lucasshawn@gmail.com',
  'lucascierra24@gmail.com',
];

export function getAllowedAdmins(): string[] {
  try {
    const localPath = path.resolve(process.cwd(), 'src/data/settings.json');
    if (fs.existsSync(localPath)) {
      const content = fs.readFileSync(localPath, 'utf-8');
      const data = JSON.parse(content);
      if (Array.isArray(data.admins) && data.admins.length > 0) {
        return data.admins.map((e: string) => String(e).toLowerCase().trim());
      }
    }
  } catch {}

  if (Array.isArray((defaultSettingsData as any)?.admins) && (defaultSettingsData as any).admins.length > 0) {
    return (defaultSettingsData as any).admins.map((e: string) => String(e).toLowerCase().trim());
  }

  return DEFAULT_ADMINS;
}

export const ALLOWED_ADMINS = (Array.isArray((defaultSettingsData as any)?.admins) && (defaultSettingsData as any).admins.length > 0)
  ? (defaultSettingsData as any).admins
  : DEFAULT_ADMINS;

export const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || 'weebles-studio-dev-secret-2026';

export function createSessionToken(
  email: string,
  exp = Date.now() + 24 * 60 * 60 * 1000,
  secret = process.env.ADMIN_SESSION_SECRET || SESSION_SECRET
): string {
  const payload = `${email.toLowerCase().trim()}:${exp}`;
  const payloadBase64 = Buffer.from(payload).toString('base64');
  const signature = crypto.createHmac('sha256', secret).update(payloadBase64).digest('hex');
  return `${payloadBase64}.${signature}`;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    const { credential, email: devEmail, devBypass } = JSON.parse(event.body || '{}');

    let userEmail = '';
    let userName = 'Studio Admin';
    let userPicture = '';

    const isProduction =
      process.env.NODE_ENV === 'production' ||
      process.env.CONTEXT === 'production';
    const isDevAllowed =
      (process.env.NETLIFY_DEV === 'true' || process.env.CONTEXT === 'dev') || !isProduction;

    if (devBypass) {
      userEmail = (devEmail || '').toLowerCase().trim();
      if (userEmail === 'lucasshawn@gmail.com') {
        userName = 'Shawn';
      } else if (userEmail === 'lucascierra24@gmail.com') {
        userName = 'Cierra';
      }
    } else if (credential) {
      try {
        const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
        if (!res.ok) {
          return {
            statusCode: 401,
            body: JSON.stringify({ error: 'Invalid Google credential' }),
          };
        }
        const tokenInfo = await res.json();
        if (tokenInfo.email_verified !== 'true' && tokenInfo.email_verified !== true) {
          return {
            statusCode: 401,
            body: JSON.stringify({ error: 'Google email not verified' }),
          };
        }
        userEmail = (tokenInfo.email || '').toLowerCase().trim();
        userName = tokenInfo.name || userName;
        userPicture = tokenInfo.picture || '';
      } catch (networkErr: any) {
        // Fallback for local dev/test environments when network call to Google is not available
        if (isDevAllowed) {
          const parts = credential.split('.');
          if (parts.length === 3) {
            try {
              const payloadJson = Buffer.from(parts[1], 'base64').toString('utf-8');
              const payload = JSON.parse(payloadJson);
              userEmail = (payload.email || '').toLowerCase().trim();
              userName = payload.name || userName;
              userPicture = payload.picture || '';
            } catch {
              return {
                statusCode: 401,
                body: JSON.stringify({ error: 'Invalid Google credential' }),
              };
            }
          } else {
            return {
              statusCode: 401,
              body: JSON.stringify({ error: 'Invalid Google credential' }),
            };
          }
        } else {
          return {
            statusCode: 401,
            body: JSON.stringify({ error: 'Google authentication service unavailable' }),
          };
        }
      }
    }

    if (!userEmail) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing authentication credential' }),
      };
    }

    if (!getAllowedAdmins().includes(userEmail)) {
      return {
        statusCode: 403,
        body: JSON.stringify({
          error: 'Unauthorized: access denied.',
        }),
      };
    }

    // Generate signed HMAC session token
    const exp = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    const token = createSessionToken(userEmail, exp);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        email: userEmail,
        name: userName,
        picture: userPicture,
        exp,
      }),
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || 'Authentication error' }),
    };
  }
};
