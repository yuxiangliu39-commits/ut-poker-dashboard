// Returns the raw sheet cells the dashboard needs. Only fixed ranges of the two
// report spreadsheets can be read; the month is checked against a fixed list.
const { DAILY_SHEET, COUPON_SHEET, sheetsGet } = require('./_lib');

const MONTHS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const monthRange = (m) => `'${m}月TLT報表'!A2:Z36`;

module.exports = async (req, res) => {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');

  const url = new URL(req.url, 'http://x');
  const month = Number(url.searchParams.get('month'));
  const only = url.searchParams.get('only'); // "tlt" = just the selected month
  if (!MONTHS.includes(month)) { res.statusCode = 400; return res.end('{"error":"month"}'); }

  try {
    const meta = await sheetsGet(DAILY_SHEET + '?fields=sheets.properties.title');
    const titles = new Set(meta.sheets.map((s) => s.properties.title));
    const has = (m) => titles.has(`${m}月TLT報表`);

    const want = []; // [datasetId, range]
    if (has(month)) want.push(['tlt', monthRange(month)]);
    if (only !== 'tlt') MONTHS.filter(has).forEach((m) => want.push(['tlt_m' + m, monthRange(m)]));

    const out = {};
    if (!has(month)) out.tlt = { status: 'error', message: `試算表裡還沒有「${month}月TLT報表」分頁` };
    if (only !== 'tlt') MONTHS.filter((m) => !has(m)).forEach((m) => { out['tlt_m' + m] = { status: 'ok', values: [], range: monthRange(m) }; });

    if (want.length) {
      const q = want.map(([, r]) => 'ranges=' + encodeURIComponent(r)).join('&');
      const j = await sheetsGet(`${DAILY_SHEET}/values:batchGet?${q}`);
      want.forEach(([id, range], i) => { out[id] = { status: 'ok', values: j.valueRanges[i].values || [], range }; });
    }
    if (only !== 'tlt') {
      const cr = [['coupon_issue', '總發送量!A3:I200'], ['coupon_use', '使用量!A3:H200']];
      const q = cr.map(([, r]) => 'ranges=' + encodeURIComponent(r)).join('&');
      const j = await sheetsGet(`${COUPON_SHEET}/values:batchGet?${q}`);
      cr.forEach(([id, range], i) => { out[id] = { status: 'ok', values: j.valueRanges[i].values || [], range }; });
    }
    res.end(JSON.stringify({ at: new Date().toISOString(), datasets: out }));
  } catch (e) {
    res.statusCode = 502;
    res.end(JSON.stringify({ error: String(e.message || e) }));
  }
};
