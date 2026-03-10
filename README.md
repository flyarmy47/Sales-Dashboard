# Launch House Golf — Sales Dashboard

Live sales dashboard for Thomas Blase and the Launch House Golf team. Built on Netlify + Supabase + HubSpot API + Google Calendar.

**Live URL:** `https://sales.launchhouse.golf`

---

## What This Does

- **Live HubSpot data** — tasks and deals load fresh on every page visit
- **One-click task completion** — marks tasks complete in HubSpot instantly (no copy/paste relay)
- **Inline deal stage moves** — update deal stages directly from the pipeline board
- **Google Calendar** — today's schedule pulled live from Google Calendar
- **Zero CORS issues** — all API calls run server-side in Netlify Functions
- **Activity log** — every task completion and deal move logged to Supabase

---

## Stack

| Layer | Technology |
|---|---|
| Hosting | Netlify (free tier) |
| Domain | `sales.launchhouse.golf` (CNAME to Netlify) |
| Backend | Netlify Functions (serverless Node.js) |
| CRM | HubSpot Private App API |
| Calendar | Google Calendar API (Service Account) |
| Database | Supabase (activity log + optional caching) |

---

## Setup Guide

### 1. Clone and Install

```bash
git clone https://github.com/YOUR_ORG/launchhouse-sales.git
cd launchhouse-sales
npm install
```

### 2. Create a HubSpot Private App

1. Go to **HubSpot → Settings → Integrations → Private Apps**
2. Click **Create a private app**
3. Name it: `Sales Dashboard`
4. Under **Scopes**, enable:
   - `crm.objects.tasks.read`
   - `crm.objects.tasks.write`
   - `crm.objects.deals.read`
   - `crm.objects.deals.write`
   - `crm.objects.contacts.read`
5. Click **Create app** → copy the access token (starts with `pat-na1-...`)

### 3. Set Up Google Calendar Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or use existing): `Launch House Sales`
3. Enable **Google Calendar API**: APIs & Services → Enable APIs → search "Google Calendar API"
4. Create Service Account: IAM & Admin → Service Accounts → Create
   - Name: `sales-dashboard`
   - Role: `Viewer` (or no role needed)
5. Click the service account → **Keys** tab → **Add Key** → **Create new key** → JSON
6. Download the JSON file — you'll need the `client_email` and `private_key` fields
7. **Share Thomas's Google Calendar** with the service account email:
   - Open Google Calendar → Settings → your calendar → Share with specific people
   - Add the service account email with **"See all event details"** permission

### 4. Set Up Supabase

1. Go to your [Supabase dashboard](https://app.supabase.com)
2. Open your project → **SQL Editor**
3. Paste and run the contents of `supabase/migrations/001_create_activity_log.sql`
4. Go to **Project Settings → API** and copy:
   - **Project URL** (looks like `https://xxxx.supabase.co`)
   - **`service_role` secret key**
   - **`anon` public key**

### 5. Configure Netlify

#### Connect GitHub to Netlify

1. Log in to [Netlify](https://app.netlify.com)
2. **Add new site → Import from Git**
3. Choose your GitHub repo: `launchhouse-sales`
4. Build settings are auto-detected from `netlify.toml`
5. Click **Deploy site**

#### Set Environment Variables in Netlify

Go to: **Site Settings → Environment Variables → Add a variable**

| Key | Value |
|---|---|
| `HUBSPOT_ACCESS_TOKEN` | `pat-na1-...` from step 2 |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `sales-dashboard@your-project.iam.gserviceaccount.com` |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | The full private key from the JSON file (include `-----BEGIN PRIVATE KEY-----` etc.) |
| `THOMAS_CALENDAR_ID` | `thomas@launchhouse.golf` |
| `SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Your service role key |
| `SUPABASE_ANON_KEY` | Your anon key |
| `API_SECRET` | Any random string (generate with `openssl rand -hex 32`) |
| `APP_URL` | `https://sales.launchhouse.golf` |

### 6. Configure DNS (Custom Domain)

In **Cloudflare / your DNS provider**, add:

```
Type:  CNAME
Name:  sales
Value: your-site-name.netlify.app
TTL:   Auto
```

Then in Netlify: **Domain management → Add custom domain → sales.launchhouse.golf**

Netlify auto-provisions an SSL certificate (Let's Encrypt). Takes 1–5 minutes.

---

## Local Development

```bash
# Install Netlify CLI globally
npm install -g netlify-cli

# Copy env template
cp .env.example .env
# Fill in your values in .env

# Start local dev server (functions + frontend on port 8888)
netlify dev
```

Open `http://localhost:8888`

---

## API Endpoints

All endpoints are serverless Netlify Functions, accessible at `/api/*`:

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/tasks` | Fetch all incomplete HubSpot tasks |
| `POST` | `/api/complete-task` | Mark a task complete in HubSpot |
| `GET` | `/api/deals` | Fetch all active HubSpot deals |
| `POST` | `/api/deals` | Move a deal to a new stage |
| `GET` | `/api/calendar` | Fetch today's Google Calendar events |
| `GET` | `/api/health` | Check connectivity to all services |

---

## Project Structure

```
launchhouse-sales/
├── netlify.toml                    # Netlify build + redirect config
├── package.json
├── .env.example                    # Template — copy to .env, never commit .env
├── .gitignore
│
├── netlify/functions/              # Server-side API (runs on Netlify, not browser)
│   ├── _helpers.js                 # Shared: CORS headers, auth, response utils
│   ├── _hubspot.js                 # Shared: HubSpot API wrapper
│   ├── _gcal.js                    # Shared: Google Calendar API wrapper
│   ├── tasks.js                    # GET /api/tasks
│   ├── complete-task.js            # POST /api/complete-task  ← the key fix
│   ├── deals.js                    # GET + POST /api/deals
│   ├── calendar.js                 # GET /api/calendar
│   └── health.js                   # GET /api/health
│
├── public/                         # Static frontend (served directly by Netlify)
│   ├── index.html                  # Main dashboard
│   └── js/
│       └── api.js                  # Frontend API helper module
│
└── supabase/
    └── migrations/
        └── 001_create_activity_log.sql
```

---

## Deploying Updates

Any push to `main` triggers an automatic Netlify deploy:

```bash
git add .
git commit -m "Update dashboard"
git push origin main
# Netlify auto-deploys in ~30 seconds
```

---

## Future: Per-Rep Login (Cam + Todd)

The current setup shows Thomas's view. To add per-rep authentication:

1. Enable **Netlify Identity** (free, one click in Netlify dashboard)
2. Invite `cam@launchhouse.golf` and `todd@launchhouse.golf`
3. Each rep logs in → dashboard filters to their HubSpot owner ID automatically
4. Calendar shows their own Google Calendar

This is ~1 day of work when you're ready.

---

## Troubleshooting

**Tasks/deals not loading?**
→ Visit `https://sales.launchhouse.golf/api/health` — it shows exactly what's connected

**HubSpot 401 error?**
→ Check your `HUBSPOT_ACCESS_TOKEN` in Netlify env vars — it may have expired (Private App tokens don't expire, but check it was copied correctly)

**Google Calendar empty?**
→ Make sure Thomas's calendar is shared with the service account email

**Supabase errors in logs?**
→ The dashboard still works without Supabase — it just won't log activity. Run the SQL migration from step 4.
