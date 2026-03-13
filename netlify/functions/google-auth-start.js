// netlify/functions/google-auth-start.js
// GET /api/google-auth-start
// Redirects user to Google OAuth to grant calendar access
// Query param: ?email=thomas@launchhouse.golf (passed from frontend session)

const { err } = require('./_helpers');

exports.handler = async (event) => {
  const email = event.queryStringParameters?.email;
  if (!email) return err('Missing email parameter', 400);

  const clientId    = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const redirectUri = `${process.env.APP_URL}/api/google-auth-callback`;

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: 'code',
    scope:         'https://www.googleapis.com/auth/calendar',
    access_type:   'offline',
    prompt:        'consent',   // Force consent to always get refresh_token
    state:         email,       // Pass email through so callback knows who this is
    login_hint:    email,       // Pre-fill the Google sign-in with their email
  });

  return {
    statusCode: 302,
    headers: { Location: `https://accounts.google.com/o/oauth2/v2/auth?${params}` },
    body: '',
  };
};
