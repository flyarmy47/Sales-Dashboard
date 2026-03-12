// netlify/functions/activity-feed.js
// GET /api/activity-feed?limit=20 — recent activity from Supabase

const { ok, err, preflight, getActivityFeed } = require('./_helpers');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();

  try {
    const limit = Math.min(parseInt(event.queryStringParameters?.limit || '20'), 100);
    const feed = await getActivityFeed(limit);
    return ok(feed);
  } catch (e) {
    console.error('activity-feed error:', e.message);
    return err(`Failed to fetch activity feed: ${e.message}`, 500);
  }
};
