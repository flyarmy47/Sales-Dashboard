const GCAL_BASE='https://www.googleapis.com/calendar/v3';
function base64url(str){return Buffer.from(str).toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');}
async function getAccessToken(){
  const email=process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,rawKey=process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if(!email||!rawKey)throw new Error('Google Service Account credentials not configured.');
  const privateKey=rawKey.replace(/\\n/g,'\n'),now=Math.floor(Date.now()/1000);
  const header=base64url(JSON.stringify({alg:'RS256',typ:'JWT'}));
  const payload=base64url(JSON.stringify({iss:email,scope:'https://www.googleapis.com/auth/calendar.readonly',aud:'https://oauth2.googleapis.com/token',exp:now+3600,iat:now}));
  const si=header+'.'+payload,crypto=await import('crypto'),sign=crypto.createSign('RSA-SHA256');
  sign.update(si);const sig=sign.sign(privateKey,'base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
  const res=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:si+'.'+sig})});
  const data=await res.json();if(!res.ok)throw new Error('Google auth failed: '+(data.error_description||data.error));return data.access_token;
}
async function getTodayEvents(calendarId){
  const token=await getAccessToken(),tz='America/New_York',today=new Date().toLocaleDateString('sv-SE',{timeZone:tz});
  const params=new URLSearchParams({timeMin:new Date(today+'T00:00:00-04:00').toISOString(),timeMax:new Date(today+'T23:59:59-04:00').toISOString(),singleEvents:'true',orderBy:'startTime',timeZone:tz});
  const res=await fetch(GCAL_BASE+'/calendars/'+encodeURIComponent(calendarId)+'/events?'+params,{headers:{Authorization:'Bearer '+token}});
  const data=await res.json();if(!res.ok)throw new Error('GCal: '+(data.error?.message||JSON.stringify(data)));return data.items||[];
}
module.exports={getTodayEvents};