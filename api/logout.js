module.exports = (req, res) => {
  res.setHeader('set-cookie', 'ut_dash=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
  res.setHeader('cache-control', 'no-store');
  res.end('{"ok":true}');
};
