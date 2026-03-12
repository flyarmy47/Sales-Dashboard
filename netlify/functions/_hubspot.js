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

// GET deal details — full deal with company + contacts + tasks
async function getDealDetails(dealId) {
  // Fetch full deal object
  const deal = await hubspotFetch(`/crm/v3/objects/deals/${dealId}?properties=dealname,amount,dealstage,closedate,description,hubspot_owner_id`);

  const dealData = deal.properties;

  // Fetch associated company
  let companyId = null;
  let companyName = null;
  try {
    const companies = await hubspotFetch(`/crm/v3/objects/deals/${dealId}/associations/companies`);
    if (companies.results && companies.results.length > 0) {
      companyId = companies.results[0].id;
      const company = await hubspotFetch(`/crm/v3/objects/companies/${companyId}?properties=name`);
      companyName = company.properties.name || 'Unknown Company';
    }
  } catch (e) {
    // Company association might not exist
  }

  // Fetch associated contacts
  let contacts = [];
  try {
    const contactAssocs = await hubspotFetch(`/crm/v3/objects/deals/${dealId}/associations/contacts`);
    if (contactAssocs.results && contactAssocs.results.length > 0) {
      // Fetch details for each contact
      const contactIds = contactAssocs.results.map(c => c.id);
      for (const cId of contactIds) {
        try {
          const contact = await hubspotFetch(`/crm/v3/objects/contacts/${cId}?properties=firstname,lastname,jobtitle,email,phone`);
          const props = contact.properties;
          contacts.push({
            id: cId,
            name: `${props.firstname || ''} ${props.lastname || ''}`.trim() || 'Unknown',
            title: props.jobtitle || null,
            email: props.email || null,
            phone: props.phone || null,
          });
        } catch (e) {
          // Skip contacts that fail to fetch
        }
      }
    }
  } catch (e) {
    // Contact associations might not exist
  }

  // Fetch associated tasks
  let associatedTasks = [];
  try {
    const taskBody = {
      filterGroups: [{
        associatedWith: [{ objectType: 'deals', operator: 'EQUAL', objectIdValues: [parseInt(dealId)] }]
      }],
      properties: ['hs_task_subject', 'hs_task_status'],
      limit: 10,
    };
    const tasksResp = await hubspotFetch('/crm/v3/objects/tasks/search', {
      method: 'POST',
      body: JSON.stringify(taskBody),
    });
    associatedTasks = (tasksResp.results || []).map(t => ({
      id: t.id,
      subject: t.properties.hs_task_subject || '(No subject)',
      status: t.properties.hs_task_status || 'NOT_STARTED',
    }));
  } catch (e) {
    // Task search might fail
  }

  // Get owner info
  const ownerId = dealData.hubspot_owner_id;
  let ownerName = null;
  if (ownerId) {
    try {
      const owner = await hubspotFetch(`/crm/v3/objects/contacts/${ownerId}`);
      ownerName = owner.properties?.firstname || owner.properties?.lastname || 'Unknown';
    } catch (e) {
      // Owner lookup failed
    }
  }

  return {
    id: dealId,
    name: dealData.dealname || '(Unnamed deal)',
    amount: parseInt(dealData.amount) || 0,
    stage: dealData.dealstage || '',
    stageName: dealData.dealstage, // Frontend will map this to stage name
    closeDate: dealData.closedate ? dealData.closedate.split('T')[0] : null,
    description: dealData.description || null,
    companyId,
    companyName,
    contacts,
    owner: ownerId ? { id: ownerId, name: ownerName || 'Unknown' } : null,
    associatedTasks,
  };
}

// POST task — create new task with optional deal association
async function createTask(subject, dueDate, description = '', dealId = null, properties = {}) {
  const taskProps = {
    hs_task_subject: subject,
    hs_timestamp: dueDate ? `${dueDate}T00:00:00Z` : null,
    hs_task_body: description,
    hs_task_status: 'NOT_STARTED',
    ...properties,
  };

  // Remove null values
  Object.keys(taskProps).forEach(k => taskProps[k] === null && delete taskProps[k]);

  const result = await hubspotFetch('/crm/v3/objects/tasks', {
    method: 'POST',
    body: JSON.stringify({ properties: taskProps }),
  });

  const taskId = result.id;

  // If dealId provided, create association
  if (dealId) {
    try {
      await hubspotFetch(`/crm/v3/objects/tasks/${taskId}/associations/deals/batch/create`, {
        method: 'POST',
        body: JSON.stringify({
          inputs: [{
            id: String(dealId),
            type: 'deal_to_task'
          }]
        }),
      });
    } catch (e) {
      // Association creation might fail, but task is created
      console.warn('Failed to associate task with deal:', e.message);
    }
  }

  return {
    id: taskId,
    subject: subject,
    dueDate: dueDate,
    status: 'NOT_STARTED',
  };
}

// GET task summary — counts of overdue and next-7-days tasks
async function getTaskSummary() {
  const allTasks = await getTasks();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const next7 = new Date(today);
  next7.setDate(next7.getDate() + 7);

  const overdue = [];
  const next7Days = [];
  const highPriority = [];

  for (const task of allTasks) {
    const taskId = task.id;
    const subj = task.properties.hs_task_subject || '(No subject)';
    const due = task.properties.hs_timestamp ? task.properties.hs_timestamp.split('T')[0] : null;
    const pri = task.properties.hs_task_priority || 'NONE';
    const owner = task.properties.hubspot_owner_id || null;
    const status = task.properties.hs_task_status || 'NOT_STARTED';

    if (pri === 'HIGH') highPriority.push({ id: taskId, subject: subj });

    if (!due) continue;

    const dueDate = new Date(due);
    dueDate.setHours(0, 0, 0, 0);

    if (dueDate < today) {
      const daysOverdue = Math.floor((today - dueDate) / 86400000);
      overdue.push({
        id: taskId,
        subject: subj,
        daysOverdue,
        owner,
        priority: pri,
        status,
      });
    } else if (dueDate <= next7) {
      const daysUntilDue = Math.floor((dueDate - today) / 86400000);
      next7Days.push({
        id: taskId,
        subject: subj,
        daysUntilDue,
        dueDate: due,
        owner,
        priority: pri,
        status,
      });
    }
  }

  return {
    overdue,
    next7Days,
    summary: {
      overdueCount: overdue.length,
      next7Count: next7Days.length,
      highPriorityCount: highPriority.length,
    },
  };
}

module.exports = { getTasks, getDeals, completeTask, moveDealStage, getDealDetails, createTask, getTaskSummary };
