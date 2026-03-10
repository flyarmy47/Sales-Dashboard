// netlify/functions/health.js
const { ok, err, preflight } = require('./_helpers');
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  const checks = {};
  checks.hubspot_token = !!process.env.HUBSPOT_ACCESS_TOKEN ? 'configured' : 'MISSING';
  checks.google_calendar = (!!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && !!process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) ? 'configured' : 'not_configured';
  checks.supabase = (!!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY) ? 'configured' : 'not_configured';
  try { const res = await fetch('https://api.hubapi.com/crm/v3/objects/tasks?limit=1', { headers: { Authorization: 'Bearer ' + process.env.HUBSPOT_ACCESS_TOKEN } }); checks.hubspot_api = res.ok ? 'connected' : 'error_' + res.status; } catch (e) { checks.hubspot_api = 'error: ' + e.message; }
  return { statusCode: checks.hubspot_api === 'connected' ? 200 : 207, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: checks.hubspot_api === 'connected', timestamp: new Date().toISOString(), checks }) };
};