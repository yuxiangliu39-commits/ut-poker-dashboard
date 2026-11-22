// Setup check. Reports only the shape of the key setting (length, which field
// names appear), never any of its content, plus which deployment is running.
module.exports = (req, res) => {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '';
  const s = raw.trim();
  let parses = false, hasEmail = false, hasKey = false, type = null;
  try {
    const j = JSON.parse(s);
    parses = true;
    hasEmail = typeof j.client_email === 'string' && j.client_email.endsWith('.gserviceaccount.com');
    hasKey = typeof j.private_key === 'string' && j.private_key.includes('PRIVATE KEY');
    type = typeof j.type === 'string' ? j.type : null;
  } catch (e) { /* shape only */ }
  const out = {
    deployment: {
      commit: (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || null,
      env: process.env.VERCEL_ENV || null,
    },
    key: {
      set: s.length > 0,
      length: s.length,
      lines: s ? s.split('\n').length : 0,
      startsWithBrace: s.startsWith('{'),
      endsWithBrace: s.endsWith('}'),
      parsesAsJson: parses,
      type: type === 'service_account' || type === 'authorized_user' ? type : (type ? 'other' : null),
      mentions: {
        service_account: s.includes('service_account'),
        client_email: s.includes('client_email'),
        private_key: s.includes('private_key'),
        BEGIN_PRIVATE_KEY: s.includes('BEGIN PRIVATE KEY'),
        client_secret: s.includes('client_secret'),
        installed_or_web: /"(installed|web)"\s*:/.test(s),
      },
      validEmail: hasEmail,
      validKey: hasKey,
    },
  };
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(out, null, 2));
};
