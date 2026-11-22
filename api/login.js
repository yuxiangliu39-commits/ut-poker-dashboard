const { makeSessionCookie, passwordMatches } = require('./_lib');

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const password = body && body.password;
  // Small fixed delay slows down password guessing.
  await new Promise((r) => setTimeout(r, 400));
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  if (!passwordMatches(password)) { res.statusCode = 401; return res.end(JSON.stringify({ ok: false, error: '密碼錯誤' })); }
  res.setHeader('set-cookie', makeSessionCookie());
  res.end(JSON.stringify({ ok: true }));
};
