// netlify/functions/create-task.js
// POST /api/create-task — create new HubSpot task with optional deal association

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
    const { subject, dueDate, priority = 'NONE', description = '', associatedDealId = null } = body;

    if (!subject || !subject.trim()) {
      return err('subject is required', 400);
    }

    // Create task
    const properties = {};
    if (priority && priority !== 'NONE') {
      properties.hs_task_priority = priority;
    }

    const result = await createTask(
      subject.trim(),
      dueDate,
      description,
      associatedDealId,
      properties
    );

    return ok(result);

  } catch (e) {
    console.error('create-task error:', e.message);
    return err(`Failed to create task: ${e.message}`, 500);
  }
};
