import { Handler } from '@netlify/functions';
import crypto from 'crypto';

export const ALLOWED_ADMINS = [
  'lucasshawn@gmail.com',
  'lucascierra24@gmail.com',
];

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
      if (!isDevAllowed) {
        return {
          statusCode: 403,
          body: JSON.stringify({ error: 'Development bypass is disabled in production.' }),
        };
      }
      // allow bypass in dev
      userEmail = (devEmail || '').toLowerCase().trim();
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

    if (!ALLOWED_ADMINS.includes(userEmail)) {
      return {
        statusCode: 403,
        body: JSON.stringify({
          error: `Unauthorized: ${userEmail} is not authorized to access the Weebles Studio admin portal.`,
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
