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
async function getTodayEvents(calendarId) {
  const token = await getAccessToken();
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
async function updateCalendarEvent(eventId, calendarId, patch) {
  const token = await getAccessToken();
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
