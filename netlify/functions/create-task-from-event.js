// netlify/functions/create-task-from-event.js
// POST /api/create-task-from-event — create HubSpot task from Google Calendar event

const { ok, err, preflight, isAuthorized } = require('./_helpers');
const { createTask } = require('./_hubspot');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (!isAuthorized(event)) return err('Unauthorized', 401);

  if (event.httpMethod !== 'POST') {
    return err('Method not allowed', 405);
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const {
      eventTitle,
      eventDate,
      eventStart,
      eventEnd,
      eventDescription = '',
      associatedDealId = null,
      customSubject = null,
    } = body;

    if (!eventTitle || !eventDate) {
      return err('eventTitle and eventDate are required', 400);
    }

    // Generate task subject
    let taskSubject = customSubject;
    if (!taskSubject) {
      taskSubject = `Follow up: ${eventTitle}`;
    }

    // Build description with event details
    let description = eventDescription || '';
    if (eventStart || eventEnd) {
      const timeInfo = [eventStart, eventEnd].filter(Boolean).join(' - ');
      if (timeInfo) {
        description = description
          ? `${description}\n\nEvent: ${timeInfo}`
          : `Event: ${timeInfo}`;
      }
    }

    // Create task
    const result = await createTask(
      taskSubject,
      eventDate,
      description,
      associatedDealId,
      { hs_task_priority: 'MEDIUM' } // Default to MEDIUM priority for event-based tasks
    );

    return ok(result);

  } catch (e) {
    console.error('create-task-from-event error:', e.message);
    return err(`Failed to create task from event: ${e.message}`, 500);
  }
};
