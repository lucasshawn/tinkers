import { Handler } from '@netlify/functions';
import crypto from 'crypto';
import defaultSettingsData from '../../src/data/settings.json';
import { loadPersistedSettings } from './_lib/storage';

export const DEFAULT_ALLOWED_ADMINS = [
  'lucasshawn@gmail.com',
  'lucascierra24@gmail.com',
];

const getEnvAdmins = (): string[] =>
  process.env.ALLOWED_ADMIN_EMAILS
    ? process.env.ALLOWED_ADMIN_EMAILS.split(',')
        .map((e) => e.toLowerCase().trim())
        .filter(Boolean)
    : [];

export const getAllowedAdmins = (): string[] => {
  let settingsAdmins: string[] = [];
  try {
    if (Array.isArray((defaultSettingsData as any)?.admins)) {
      settingsAdmins = (defaultSettingsData as any).admins;
    }
  } catch {}

  const envAdmins = getEnvAdmins();
  return Array.from(
    new Set(
      [...DEFAULT_ALLOWED_ADMINS, ...settingsAdmins, ...envAdmins]
        .map((e) => e.toLowerCase().trim())
        .filter(Boolean)
    )
  );
};

export async function resolveAllowedAdmins(event?: any): Promise<string[]> {
  const envAdmins = getEnvAdmins();
  try {
    const persistedSettings = await loadPersistedSettings(event);
    if (Array.isArray(persistedSettings?.admins)) {
      const persistedAdmins = persistedSettings.admins
        .filter((e: unknown): e is string => typeof e === 'string')
        .map((e: string) => e.toLowerCase().trim())
        .filter(Boolean);
      if (persistedAdmins.length > 0) {
        return Array.from(new Set([...persistedAdmins, ...envAdmins]));
      }
    }
  } catch (err) {
    console.warn('Failed to load persisted settings for admin authorization:', err);
  }

  return getAllowedAdmins();
}

export const ALLOWED_ADMINS = getAllowedAdmins();

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

export async function verifySessionToken(
  authHeader?: string,
  event?: any
): Promise<string | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.replace('Bearer ', '').trim();
  try {
    const [payloadBase64, signature] = token.split('.');
    if (!payloadBase64 || !signature) return null;
    const sessionSecret = process.env.ADMIN_SESSION_SECRET || SESSION_SECRET;
    const expectedSig = crypto
      .createHmac('sha256', sessionSecret)
      .update(payloadBase64)
      .digest('hex');
    if (signature !== expectedSig) return null;
    const decoded = Buffer.from(payloadBase64, 'base64').toString('utf-8');
    const [email, exp] = decoded.split(':');
    if (!email || !exp || isNaN(Number(exp))) return null;
    if (Number(exp) < Date.now()) return null;
    const normalizedEmail = email.toLowerCase().trim();
    const allowedAdmins = await resolveAllowedAdmins(event);
    if (!allowedAdmins.includes(normalizedEmail)) return null;
    return normalizedEmail;
  } catch {
    return null;
  }
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    const { credential } = JSON.parse(event.body || '{}');

    if (!credential) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing authentication credential' }),
      };
    }

    let userEmail = '';
    let userName = 'Studio Admin';
    let userPicture = '';

    const isProduction =
      process.env.NODE_ENV === 'production' ||
      process.env.CONTEXT === 'production';
    const isDevAllowed =
      (process.env.NETLIFY_DEV === 'true' || process.env.CONTEXT === 'dev') || !isProduction;

    try {
      const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
      if (!res.ok) {
        if (isDevAllowed) {
          throw new Error('Google tokeninfo call failed in dev/test, falling back to payload parsing');
        }
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
      if (isDevAllowed) {
        const parts = credential.split('.');
        if (parts.length === 3) {
          try {
            const payloadJson = Buffer.from(parts[1], 'base64').toString('utf-8');
            const payload = JSON.parse(payloadJson);
            if (payload.email_verified !== true && payload.email_verified !== 'true') {
              return {
                statusCode: 401,
                body: JSON.stringify({ error: 'Google email not verified' }),
              };
            }
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

    if (!userEmail) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing authentication credential' }),
      };
    }

    const currentAllowedAdmins = await resolveAllowedAdmins(event);
    if (!currentAllowedAdmins.includes(userEmail)) {
      return {
        statusCode: 403,
        body: JSON.stringify({
          error: `Unauthorized: ${userEmail} is not an authorized administrator.`,
        }),
      };
    }

    const exp = Date.now() + 24 * 60 * 60 * 1000;
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
