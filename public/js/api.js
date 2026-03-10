// API module — calls Netlify serverless functions (no CORS, no exposed tokens)
function headers(){return{'Content-Type':'application/json'};}
async function apiFetch(path,opts={}){const res=await fetch(path,{...opts,headers:{...headers(),...(opts.headers||{})}});const data=await res.json();if(!res.ok||!data.ok)throw new Error(data.error||'HTTP '+res.status);return data.data;}
export async function fetchTasks(){return apiFetch('/api/tasks');}
export async function completeTask(taskId,taskName){return apiFetch('/api/complete-task',{method:'POST',body:JSON.stringify({taskId,taskName})});}
export async function fetchDeals(){return apiFetch('/api/deals');}
export async function moveDeal(dealId,stageId,dealName){return apiFetch('/api/deals',{method:'POST',body:JSON.stringify({dealId,stageId,dealName})});}
export async function fetchCalendar(calendarId=''){const qs=calendarId?'?calendarId='+encodeURIComponent(calendarId):'';return apiFetch('/api/calendar'+qs);}
export async function healthCheck(){const res=await fetch('/api/health');return res.json();}