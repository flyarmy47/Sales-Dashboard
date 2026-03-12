// netlify/functions/task-summary.js
// GET /api/task-summary — categorized tasks (overdue, next 7 days) with counts

const { ok, err, preflight } = require('./_helpers');
const { getTaskSummary } = require('./_hubspot');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();

  try {
    const summary = await getTaskSummary();
    return ok(summary);
  } catch (e) {
    console.error('task-summary error:', e.message);
    return err(`Failed to fetch task summary: ${e.message}`, 500);
  }
};
