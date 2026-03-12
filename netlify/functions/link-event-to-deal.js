// netlify/functions/link-event-to-deal.js
// POST /api/link-event-to-deal — link Google Calendar event to HubSpot deal via activity log

const { ok, err, preflight, isAuthorized, logActivity } = require('./_helpers');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (!isAuthorized(event)) return err('Unauthorized', 401);

  if (event.httpMethod !== 'POST') {
    return err('Method not allowed', 405);
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { eventTitle, eventDate, dealId } = body;

    if (!eventTitle || !dealId) {
      return err('eventTitle and dealId are required', 400);
    }

    // Log this link in the activity feed
    const activityText = `Event "${eventTitle}" linked to deal`;
    await logActivity('event_linked_to_deal', 'deal', dealId, dealId, activityText);

    return ok({
      dealId,
      message: `Event linked to deal. Activity logged.`,
    });

  } catch (e) {
    console.error('link-event-to-deal error:', e.message);
    return err(`Failed to link event: ${e.message}`, 500);
  }
};
