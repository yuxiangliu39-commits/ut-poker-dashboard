// Shared helpers for the API routes (files starting with "_" are not routes on Vercel).
const crypto = require('node:crypto');

const DAILY_SHEET = '1AA5ND3W18M3y_44W6-1G9rC5FCK719Rbkfzd2yWJxPY'; // 每日報表
const COUPON_SHEET = '1K0fg4LWicoJl1tGvTkb0wLklSZbAIKfez0CxEjW6oKw'; // 週年慶全免折抵報表
const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

// --- Google service account (JWT → access token), cached per warm instance
let cachedToken = null;
async function googleToken() {
  if (cachedToken && cachedToken.exp > Date.now() + 60e3) return cachedToken.token;
  const sa = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '{}');
  if (!sa.client_email || !sa.private_key) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not set');
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  }));
  const sig = b64url(crypto.createSign('RSA-SHA256').update(header + '.' + claim).sign(sa.private_key));
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${header}.${claim}.${sig}` }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error('Google 驗證失敗：' + (j.error_description || j.error || r.status));
  cachedToken = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return cachedToken.token;
}

async function sheetsGet(path) {
  const token = await googleToken();
  const r = await fetch('https://sheets.googleapis.com/v4/spreadsheets/' + path, { headers: { authorization: 'Bearer ' + token } });
  const j = await r.json();
  if (!r.ok) throw new Error('讀取試算表失敗：' + ((j.error && j.error.message) || r.status));
  return j;
}

module.exports = { DAILY_SHEET, COUPON_SHEET, sheetsGet };
