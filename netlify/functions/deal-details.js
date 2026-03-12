// netlify/functions/deal-details.js
// GET /api/deal-details?dealId=12345 — full deal with company, contacts, tasks

const { ok, err, preflight } = require('./_helpers');
const { getDealDetails } = require('./_hubspot');

const STAGE_MAP = {
  '1018756729': 'Discovery',
  '986576445': 'Quote Prep',
  '986576447': 'Feasibility',
  '986576449': 'Ops Review',
  '1296484709': 'Contract Out',
  '1018756730': 'GBTM',
  '986576450': 'Closed Won',
  '986576451': 'Closed Lost'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();

  try {
    const dealId = event.queryStringParameters?.dealId;
    if (!dealId) {
      return err('dealId query parameter required', 400);
    }

    const details = await getDealDetails(dealId);

    // Map stage ID to name
    details.stageName = STAGE_MAP[details.stage] || 'Unknown';

    return ok(details);

  } catch (e) {
    console.error('deal-details error:', e.message);
    return err(`Failed to fetch deal details: ${e.message}`, 500);
  }
};
