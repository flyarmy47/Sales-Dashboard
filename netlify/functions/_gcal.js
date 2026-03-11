// netlify/functions/_gcal.js
// Shared Google Calendar helper using OAuth2 refresh token

const GCAL_BASE = 'https://www.googleapis.com/calendar/v3';

async function getAccessToken() {
  const clientId     = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Google OAuth credentials not configured.');
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type:    'refresh_token',
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
  const tz    = 'America/New_York';

  // Today's date in New York timezone (YYYY-MM-DD)
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: tz });

  // Compute NY UTC offset dynamically (handles EST/EDT automatically)
  const nyNow  = new Date(new Date().toLocaleString('en-US', { timeZone: tz }));
  const offsetMs = Date.now() - nyNow.getTime();
  const offsetH  = Math.round(offsetMs / 3600000);
  const sign     = offsetH <= 0 ? '-' : '+';
  const offset   = `${sign}${String(Math.abs(offsetH)).padStart(2, '0')}:00`;

  const params = new URLSearchParams({
    timeMin:      `${today}T00:00:00${offset}`,
    timeMax:      `${today}T23:59:59${offset}`,
    singleEvents: 'true',
    orderBy:      'startTime',
    timeZone:     tz,
  });

  const data = await gcalFetch(
    `/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    token,
  );
  return data.items || [];
}

module.exports = { getTodayEvents };
