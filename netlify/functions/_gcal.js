// netlify/functions/_gcal.js
// Shared Google Calendar helper using Service Account auth

const GCAL_BASE = 'https://www.googleapis.com/calendar/v3';

// Minimal JWT creation for Google Service Account (no external library needed)
function base64url(str) {
  return Buffer.from(str).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function getAccessToken() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!email || !rawKey) {
    throw new Error('Google Service Account credentials not configured.');
  }

  // Fix escaped newlines from env var storage
  const privateKey = rawKey.replace(/\\n/g, '\n');

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({
    iss: email,
    scope: 'https://www.googleapis.com/auth/calendar.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }));

  const signingInput = `${header}.${payload}`;

  // Use Node's built-in crypto for RSA signing
  const crypto = await import('crypto');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signingInput);
  const signature = sign.sign(privateKey, 'base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const jwt = `${signingInput}.${signature}`;

  // Exchange JWT for access token
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Google auth failed: ${data.error_description || data.error}`);
  return data.access_token;
}

async function gcalFetch(path, token) {
  const res = await fetch(`${GCAL_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`GCal API error: ${data.error?.message || JSON.stringify(data)}`);
  return data;
}

// GET today's events for a calendar
async function getTodayEvents(calendarId) {
  const token = await getAccessToken();
  const tz = 'America/New_York';
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: tz }); // YYYY-MM-DD
  const min = `${today}T00:00:00`;
  const max = `${today}T23:59:59`;
  const params = new URLSearchParams({
    timeMin: new Date(min + '-04:00').toISOString(),
    timeMax: new Date(max + '-04:00').toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    timeZone: tz,
  });
  const data = await gcalFetch(`/calendars/${encodeURIComponent(calendarId)}/events?${params}`, token);
  return data.items || [];
}

module.exports = { getTodayEvents };
