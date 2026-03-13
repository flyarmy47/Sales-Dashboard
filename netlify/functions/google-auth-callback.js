// netlify/functions/google-auth-callback.js
// GET /api/google-auth-callback
// Google redirects here after user grants calendar access
// Exchanges auth code for refresh token, stores in Supabase

exports.handler = async (event) => {
  const code  = event.queryStringParameters?.code;
  const email = event.queryStringParameters?.state;  // We passed email as state
  const error = event.queryStringParameters?.error;

  const appUrl = process.env.APP_URL || 'https://sales.launchhouse.golf';

  if (error) {
    return { statusCode: 302, headers: { Location: `${appUrl}/?calendarError=${error}` }, body: '' };
  }

  if (!code || !email) {
    return { statusCode: 302, headers: { Location: `${appUrl}/?calendarError=missing_params` }, body: '' };
  }

  try {
    // Exchange auth code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     process.env.GOOGLE_OAUTH_CLIENT_ID,
        client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
        redirect_uri:  `${appUrl}/api/google-auth-callback`,
        grant_type:    'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.refresh_token) {
      console.error('Token exchange failed:', tokenData);
      return { statusCode: 302, headers: { Location: `${appUrl}/?calendarError=token_exchange_failed` }, body: '' };
    }

    // Store refresh token in Supabase
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const upsertRes = await fetch(
      `${supabaseUrl}/rest/v1/user_tokens?on_conflict=user_email`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type':  'application/json',
          'Prefer':        'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          user_email:    email,
          provider:      'google',
          refresh_token: tokenData.refresh_token,
          scopes:        'https://www.googleapis.com/auth/calendar',
          updated_at:    new Date().toISOString(),
        }),
      }
    );

    if (!upsertRes.ok) {
      const errText = await upsertRes.text();
      console.error('Supabase upsert failed:', errText);
      return { statusCode: 302, headers: { Location: `${appUrl}/?calendarError=storage_failed` }, body: '' };
    }

    // Success — redirect back to dashboard
    return { statusCode: 302, headers: { Location: `${appUrl}/?calendarLinked=true` }, body: '' };

  } catch (e) {
    console.error('Google auth callback error:', e.message);
    return { statusCode: 302, headers: { Location: `${appUrl}/?calendarError=server_error` }, body: '' };
  }
};
