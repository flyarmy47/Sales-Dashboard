// netlify/functions/_helpers.js
// Shared response helpers, CORS headers, and simple auth

const ALLOWED_ORIGIN = process.env.APP_URL || 'https://sales.launchhouse.golf';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'Content-Type, X-API-Secret',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};

function ok(data, status = 200) {
  return {
    statusCode: status,
    headers: CORS_HEADERS,
    body: JSON.stringify({ ok: true, data }),
  };
}

function err(message, status = 500, details = null) {
  console.error(`[API Error ${status}] ${message}`, details || '');
  return {
    statusCode: status,
    headers: CORS_HEADERS,
    body: JSON.stringify({ ok: false, error: message }),
  };
}

function preflight() {
  return { statusCode: 204, headers: CORS_HEADERS, body: '' };
}

// Validate the X-API-Secret header matches our env var
function isAuthorized(event) {
  const secret = process.env.API_SECRET;
  if (!secret) return true; // dev mode — no secret set
  return event.headers['x-api-secret'] === secret;
}

// Supabase activity logging — best-effort, non-fatal if fails
async function logActivity(action, objectType, objectId, objectName, newValue = null) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.warn('Supabase env vars not set, skipping activity log');
      return;
    }

    const res = await fetch(`${supabaseUrl}/rest/v1/activity_log`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        action,
        object_type: objectType,
        object_id: String(objectId),
        object_name: objectName,
        new_value: newValue,
        completed_at: new Date().toISOString(),
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.warn(`Supabase activity log failed: ${res.status} ${text}`);
    }
  } catch (e) {
    console.warn('Activity logging error (non-fatal):', e.message);
  }
}

// Query activity feed from Supabase
async function getActivityFeed(limit = 20) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return []; // Gracefully degrade if Supabase not configured
  }

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/activity_log?order=completed_at.desc&limit=${limit}`,
      {
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!res.ok) {
      console.warn(`Activity feed fetch failed: ${res.status}`);
      return [];
    }

    const data = await res.json();
    return (data || []).map(row => ({
      id: row.id,
      action: row.action,
      objectType: row.object_type,
      objectId: row.object_id,
      objectName: row.object_name,
      newValue: row.new_value,
      completedAt: row.completed_at,
      displayText: generateActivityText(row.action, row.object_name, row.new_value),
    }));
  } catch (e) {
    console.warn('Activity feed query error:', e.message);
    return [];
  }
}

// Generate human-readable activity text
function generateActivityText(action, objectName, newValue) {
  if (action === 'task_completed') {
    return `Marked task complete: ${objectName}`;
  }
  if (action === 'deal_stage_moved') {
    return `Moved ${objectName} to ${newValue}`;
  }
  return `${action}: ${objectName}`;
}

module.exports = { ok, err, preflight, isAuthorized, CORS_HEADERS, logActivity, getActivityFeed };
