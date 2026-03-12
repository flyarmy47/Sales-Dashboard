// netlify/functions/complete-task.js
// POST /api/complete-task — marks a HubSpot task as COMPLETED
//
// Body: { taskId: "12345" }
//
// This runs SERVER-SIDE so there's zero CORS issue.
// The browser calls /api/complete-task (same domain),
// and THIS function calls HubSpot with the private token.

const { completeTask } = require('./_hubspot');
const { ok, err, preflight, isAuthorized, logActivity } = require('./_helpers');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (event.httpMethod !== 'POST')    return err('Method not allowed', 405);
  if (!isAuthorized(event))           return err('Unauthorized', 401);

  let taskId, taskName;
  try {
    const body = JSON.parse(event.body || '{}');
    taskId   = body.taskId;
    taskName = body.taskName || '(unknown)';
  } catch {
    return err('Invalid JSON body', 400);
  }

  if (!taskId) return err('taskId is required', 400);

  try {
    // 1. Mark complete in HubSpot
    const result = await completeTask(taskId);

    // 2. Log to Supabase activity log (best-effort — non-fatal if fails)
    await logActivity('task_completed', 'task', taskId, taskName);

    return ok({
      taskId:  String(taskId),
      status:  result?.properties?.hs_task_status || 'COMPLETED',
      message: 'Task marked complete in HubSpot',
    });

  } catch (e) {
    return err(`Failed to complete task ${taskId}: ${e.message}`, e.status || 500);
  }
};
