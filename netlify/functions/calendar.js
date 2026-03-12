// netlify/functions/calendar.js
// GET /api/calendar — returns today's Google Calendar events
// Query param: ?calendarId=thomas@launchhouse.golf (defaults to THOMAS_CALENDAR_ID env var)

const { getTodayEvents } = require('./_gcal');
const { ok, err, preflight, isAuthorized } = require('./_helpers');

// Classify event type based on title keywords
function classifyEvent(summary = '') {
  const s = summary.toLowerCase();
  if (/call|meeting|sync|standup|1:1|zoom|meet|client|demo/.test(s)) return 'meeting';
  if (/focus|block|deep|proposal|write|build|review/.test(s))        return 'focus';
  return 'admin';
}

// Format a GCal event datetime into "H:MM AM/PM"
function fmtTime(dt) {
  if (!dt) return '';
  const d = new Date(dt);
  const tz = process.env.CALENDAR_TIMEZONE || 'America/Los_Angeles';
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit',
    hour12: true, timeZone: tz,
  });
}

// Calculate duration string
function duration(start, end) {
  if (!start || !end) return '';
  const mins = (new Date(end) - new Date(start)) / 60000;
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (!isAuthorized(event))           return err('Unauthorized', 401);

  const calendarId =
    event.queryStringParameters?.calendarId ||
    process.env.THOMAS_CALENDAR_ID ||
    'primary';

  try {
    const events = await getTodayEvents(calendarId);

    const normalized = events
      .filter(e => e.status !== 'cancelled')
      .map(e => ({
        id:       e.id,
        title:    e.summary || '(No title)',
        start:    fmtTime(e.start?.dateTime || e.start?.date),
        end:      fmtTime(e.end?.dateTime   || e.end?.date),
        startISO: e.start?.dateTime || e.start?.date || '',
        endISO:   e.end?.dateTime   || e.end?.date   || '',
        dur:      duration(e.start?.dateTime, e.end?.dateTime),
        type:     classifyEvent(e.summary),
        location: e.location || '',
        link:     e.htmlLink || '',
        allDay:   !e.start?.dateTime,
      }));

    return ok(normalized);
  } catch (e) {
    // If Google Calendar isn't configured yet, return empty array gracefully
    if (e.message.includes('not configured')) {
      return ok([], 200);
    }
    return err(e.message);
  }
};
