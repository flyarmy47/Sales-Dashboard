// netlify/functions/update-event.js
// PATCH /api/update-event — reschedule or rename a Google Calendar event
// Body: { eventId, calendarId, title, startISO, endISO, timeZone }
//
// Requires GOOGLE_OAUTH_REFRESH_TOKEN to have the calendar.events scope
// (not just calendar.readonly).

const { updateCalendarEvent } = require('./_gcal');
const { ok, err, preflight, isAuthorized, logActivity } = require('./_helpers');

const TZ = 'America/New_York';

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (!isAuthorized(event))           return err('Unauthorized', 401);
  if (event.httpMethod !== 'POST')    return err('Method not allowed', 405);

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return err('Invalid JSON body', 400);
  }

  const { eventId, calendarId, title, startISO, endISO, timeZone } = body;

  if (!eventId)  return err('eventId is required', 400);
  if (!startISO) return err('startISO is required', 400);
  if (!endISO)   return err('endISO is required', 400);

  const resolvedCalendarId = calendarId || process.env.THOMAS_CALENDAR_ID || 'primary';
  const resolvedTZ         = timeZone   || TZ;

  // Build the PATCH payload — only include fields that were provided
  const patch = {
    start: { dateTime: startISO, timeZone: resolvedTZ },
    end:   { dateTime: endISO,   timeZone: resolvedTZ },
  };
  if (title) patch.summary = title;

  try {
    const updated = await updateCalendarEvent(eventId, resolvedCalendarId, patch);

    // Best-effort activity log
    await logActivity(
      'event_rescheduled',
      'event',
      eventId,
      title || updated.summary || eventId,
      new Date(startISO).toLocaleString('en-US', {
        month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit',
        timeZone: resolvedTZ,
      }),
    );

    return ok({
      id:      updated.id,
      title:   updated.summary,
      startISO: updated.start?.dateTime || updated.start?.date,
      endISO:   updated.end?.dateTime   || updated.end?.date,
      link:    updated.htmlLink,
    });
  } catch (e) {
    // If the error is a scope/permission problem, give a clear message
    if (e.message.includes('insufficientPermissions') || e.message.includes('forbidden')) {
      return err(
        'Google Calendar write access not granted. Re-authorize with the calendar.events scope.',
        403,
      );
    }
    return err(e.message);
  }
};
