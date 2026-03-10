// netlify/functions/_helpers.js
// Shared response helpers, CORS headers, and simple auth

const ALLOWED_ORIGIN = process.env.APP_URL || 'https://sales.launchhouse.golf';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'Content-Type, X-API-Secret',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Content-Type': 'application/json',
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

module.exports = { ok, err, preflight, isAuthorized, CORS_HEADERS };
