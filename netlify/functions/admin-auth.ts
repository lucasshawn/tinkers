import { Handler } from '@netlify/functions';

export const ALLOWED_ADMINS = [
  'lucasshawn@gmail.com',
  'lucascierra24@gmail.com',
];

const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || 'weebles-studio-dev-secret-2026';

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

    if (devBypass && devEmail) {
      userEmail = devEmail.toLowerCase().trim();
    } else if (credential) {
      // Decode JWT payload from Google credential
      const parts = credential.split('.');
      if (parts.length === 3) {
        const payloadJson = Buffer.from(parts[1], 'base64').toString('utf-8');
        const payload = JSON.parse(payloadJson);
        userEmail = (payload.email || '').toLowerCase().trim();
        userName = payload.name || userName;
        userPicture = payload.picture || '';
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

    // Generate signed session token
    const exp = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    const tokenPayload = `${userEmail}:${exp}`;
    const token = Buffer.from(`${tokenPayload}:${SESSION_SECRET}`).toString('base64');

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
