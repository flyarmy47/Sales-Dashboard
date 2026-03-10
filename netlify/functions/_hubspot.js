// netlify/functions/_hubspot.js
// Shared HubSpot API helper — used by all functions

const HUBSPOT_BASE = 'https://api.hubapi.com';

function getToken() {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) throw new Error('HUBSPOT_ACCESS_TOKEN environment variable is not set.');
  return token;
}

async function hubspotFetch(path, options = {}) {
  const url = `${HUBSPOT_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${getToken()}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!res.ok) {
    const msg = data?.message || data?.error || text || `HTTP ${res.status}`;
    throw Object.assign(new Error(`HubSpot API error: ${msg}`), { status: res.status, data });
  }
  return data;
}

// GET tasks — incomplete only, sorted by due date
async function getTasks() {
  const body = {
    filterGroups: [{
      filters: [{ propertyName: 'hs_task_status', operator: 'NEQ', value: 'COMPLETED' }]
    }],
    properties: ['hs_task_subject', 'hs_task_status', 'hs_task_priority', 'hs_timestamp', 'hubspot_owner_id', 'hs_task_body'],
    sorts: [{ propertyName: 'hs_timestamp', direction: 'ASCENDING' }],
    limit: 100,
  };
  const data = await hubspotFetch('/crm/v3/objects/tasks/search', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return data.results || [];
}

// GET active deals (not closed won/lost)
async function getDeals() {
  const body = {
    filterGroups: [{
      filters: [{
        propertyName: 'dealstage',
        operator: 'NOT_IN',
        values: ['986576450', '986576451'],
      }]
    }],
    properties: ['dealname', 'amount', 'dealstage', 'closedate', 'hubspot_owner_id'],
    sorts: [{ propertyName: 'amount', direction: 'DESCENDING' }],
    limit: 100,
  };
  const data = await hubspotFetch('/crm/v3/objects/deals/search', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return data.results || [];
}

// PATCH task — mark as COMPLETED
async function completeTask(taskId) {
  return hubspotFetch(`/crm/v3/objects/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      properties: { hs_task_status: 'COMPLETED' }
    }),
  });
}

// PATCH deal — update stage
async function moveDealStage(dealId, stageId) {
  return hubspotFetch(`/crm/v3/objects/deals/${dealId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      properties: { dealstage: stageId }
    }),
  });
}

module.exports = { getTasks, getDeals, completeTask, moveDealStage };
