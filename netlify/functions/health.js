// netlify/functions/health.js
// GET /api/health — checks connectivity to HubSpot + Supabase

const { ok, err, preflight } = require('./_helpers');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();

  const checks = {};

  // Check HubSpot token exists
  checks.hubspot_token = !!process.env.HUBSPOT_ACCESS_TOKEN ? 'configured' : 'MISSING';

  // Check Google Calendar credentials
  checks.google_calendar =
    (!!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
     !!process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY)
      ? 'configured' : 'not_configured';

  // Check Supabase
  checks.supabase =
    (!!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY)
      ? 'configured' : 'not_configured';

  // Quick HubSpot ping
  try {
    const res = await fetch('https://api.hubapi.com/crm/v3/objects/tasks?limit=1', {
      headers: { Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}` },
    });
    checks.hubspot_api = res.ok ? 'connected' : `error_${res.status}`;
  } catch (e) {
    checks.hubspot_api = `error: ${e.message}`;
  }

  const allGood = checks.hubspot_api === 'connected';

  return {
    statusCode: allGood ? 200 : 207,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ok: allGood,
      timestamp: new Date().toISOString(),
      checks,
    }),
  };
};
