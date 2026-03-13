// netlify/functions/_gcal.js
// Shared Google Calendar helper using OAuth2 refresh token

const GCAL_BASE = 'https://www.googleapis.com/calendar/v3';

// Get access token — tries per-user token first, falls back to env var
async function getAccessToken(userEmail = null) {
  let refreshToken = null;

  // Try per-user token from Supabase
  if (userEmail) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && supabaseKey) {
      try {
        const res = await fetch(
          `${supabaseUrl}/rest/v1/user_tokens?user_email=eq.${encodeURIComponent(userEmail)}&select=refresh_token&limit=1`,
          {
            headers: {
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type':  'application/json',
            },
          }
        );
        const rows = await res.json();
        if (rows && rows.length > 0) {
          refreshToken = rows[0].refresh_token;
        }
      } catch (e) {
        console.warn('Per-user token lookup failed:', e.message);
      }
    }
  }

  // Fall back to global env var
  if (!refreshToken) {
    refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  }

  if (!refreshToken) {
    throw new Error('No Google refresh token available. Link your calendar first.');
  }

  const clientId     = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
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

async function gcalFetch(path, token, options = {}) {
  const res = await fetch(`${GCAL_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  // 204 No Content (e.g. delete) has no body
  if (res.status === 204) return {};
  const data = await res.json();
  if (!res.ok) throw new Error(`GCal API error: ${data.error?.message || JSON.stringify(data)}`);
  return data;
}

// GET today's events for a calendar
async function getTodayEvents(calendarId, userEmail = null) {
  const token = await getAccessToken(userEmail);
  const tz = process.env.CALENDAR_TIMEZONE || 'America/Los_Angeles';

  const now = new Date();

  // Today's date in the target timezone (YYYY-MM-DD)
  const today = now.toLocaleDateString('sv-SE', { timeZone: tz });

  // UTC offset for this timezone using Intl (e.g. "GMT-07:00" → "-07:00")
  // Uses longOffset which is reliable in Node 18+ and handles DST automatically
  const tzParts = new Intl.DateTimeFormat('en', {
    timeZone: tz,
    timeZoneName: 'longOffset',
  }).formatToParts(now);
  const offset = (tzParts.find(p => p.type === 'timeZoneName')?.value || 'GMT+00:00')
    .replace('GMT', '') || '+00:00';

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

// PATCH a Google Calendar event (reschedule / rename)
// patch: { summary, start: { dateTime, timeZone }, end: { dateTime, timeZone } }
async function updateCalendarEvent(eventId, calendarId, patch, userEmail = null) {
  const token = await getAccessToken(userEmail);
  const data = await gcalFetch(
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    token,
    {
      method: 'PATCH',
      body: JSON.stringify(patch),
    },
  );
  return data;
}

module.exports = { getTodayEvents, updateCalendarEvent };
