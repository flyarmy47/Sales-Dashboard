// netlify/functions/tasks.js
// GET /api/tasks — returns all incomplete HubSpot tasks

const { getTasks } = require('./_hubspot');
const { ok, err, preflight, isAuthorized } = require('./_helpers');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (!isAuthorized(event)) return err('Unauthorized', 401);

  try {
    const tasks = await getTasks();

    // Normalize into clean objects for the frontend
    const normalized = tasks.map(t => ({
      id:       String(t.id),
      subj:     t.properties.hs_task_subject || '(No subject)',
      due:      t.properties.hs_timestamp
                  ? t.properties.hs_timestamp.split('T')[0]
                  : null,
      pri:      t.properties.hs_task_priority || 'NONE',
      owner:    t.properties.hubspot_owner_id || null,
      status:   t.properties.hs_task_status || 'NOT_STARTED',
    }));

    return ok(normalized);
  } catch (e) {
    return err(e.message);
  }
};
