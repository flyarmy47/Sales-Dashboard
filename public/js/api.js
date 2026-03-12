// public/js/api.js
// All API calls go through here. Each function calls a Netlify serverless function
// which in turn calls HubSpot or Google Calendar server-side (no CORS, no exposed tokens).

const API_SECRET = window.LH_CONFIG?.apiSecret || '';

function headers() {
  return {
    'Content-Type': 'application/json',
    ...(API_SECRET ? { 'X-API-Secret': API_SECRET } : {}),
  };
}

async function apiFetch(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { ...headers(), ...(options.headers || {}) },
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.error || `Request failed: ${res.status}`);
  }
  return data.data;
}

// ── TASKS ──────────────────────────────────────────────────────────
export async function fetchTasks() {
  return apiFetch('/api/tasks');
}

export async function completeTask(taskId, taskName) {
  return apiFetch('/api/complete-task', {
    method: 'POST',
    body: JSON.stringify({ taskId, taskName }),
  });
}

// ── DEALS ──────────────────────────────────────────────────────────
export async function fetchDeals() {
  return apiFetch('/api/deals');
}

export async function moveDeal(dealId, stageId, dealName) {
  return apiFetch('/api/deals', {
    method: 'POST',
    body: JSON.stringify({ dealId, stageId, dealName }),
  });
}

// ── CALENDAR ───────────────────────────────────────────────────────
export async function fetchCalendar(calendarId = '') {
  const qs = calendarId ? `?calendarId=${encodeURIComponent(calendarId)}` : '';
  return apiFetch(`/api/calendar${qs}`);
}

// ── HEALTH CHECK ───────────────────────────────────────────────────
export async function healthCheck() {
  const res = await fetch('/api/health');
  return res.json();
}

// ── TIER 1 FEATURES ────────────────────────────────────────────────
// Deal details
export async function fetchDealDetails(dealId) {
  return apiFetch(`/api/deal-details?dealId=${encodeURIComponent(dealId)}`);
}

// Task summary (overdue, next 7 days)
export async function fetchTaskSummary() {
  return apiFetch('/api/task-summary');
}

// Create new task
export async function createNewTask(subject, dueDate, priority, description, associatedDealId) {
  return apiFetch('/api/create-task', {
    method: 'POST',
    body: JSON.stringify({
      subject,
      dueDate,
      priority: priority || 'NONE',
      description: description || '',
      associatedDealId: associatedDealId || null,
    }),
  });
}

// Activity feed
export async function fetchActivityFeed(limit = 20) {
  return apiFetch(`/api/activity-feed?limit=${limit}`);
}

// Create task from calendar event
export async function createTaskFromEvent(eventTitle, eventDate, eventStart, eventEnd, eventDescription, associatedDealId, customSubject) {
  return apiFetch('/api/create-task-from-event', {
    method: 'POST',
    body: JSON.stringify({
      eventTitle,
      eventDate,
      eventStart,
      eventEnd,
      eventDescription: eventDescription || '',
      associatedDealId: associatedDealId || null,
      customSubject: customSubject || null,
    }),
  });
}

// Link event to deal
export async function linkEventToDeal(eventTitle, eventDate, dealId) {
  return apiFetch('/api/link-event-to-deal', {
    method: 'POST',
    body: JSON.stringify({
      eventTitle,
      eventDate,
      dealId,
    }),
  });
}
