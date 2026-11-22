// Small stand-in for the Claude dashboard runtime: the page's own code calls
// dash.loader / dash.calc / dash.data / dash.draw / dash.params / dash.setParams /
// dash.onData / dash.setLink, and this file serves them from /api/data.
(function () {
  const loaders = {}, calcs = {}, draws = {}, onDataFns = [];
  const raw = {};            // dataset id -> { status, values, range, message, rows }
  let calcCache = {};
  let params = { month: '11' };
  let started = false;

  function datasetData(id) {
    const r = raw[id];
    if (!r || r.status === 'loading') return { status: 'loading', data: [] };
    if (r.status !== 'ok') return { status: r.status, data: [], message: r.message };
    if (!r.rows) {
      if (!r.values || !r.values.length) r.rows = [];
      else {
        try {
          r.rows = loaders[id] ? loaders[id].fn({ answer: { values: r.values }, args: { range: r.range }, items: [] }) : r.values;
        } catch (e) {
          console.error('loader', id, e);
          r.status = 'error'; r.message = e.message;
          return { status: 'error', data: [], message: e.message };
        }
      }
    }
    return { status: 'ok', data: r.rows };
  }

  function calcData(id) {
    if (id in calcCache) return calcCache[id];
    calcCache[id] = { status: 'loading', data: null }; // guards against cycles
    const c = calcs[id];
    const ins = c.inputs.map(data);
    const bad = ins.find((d) => d.status !== 'ok');
    let out;
    if (bad) out = { status: bad.status, data: null, message: bad.message };
    else {
      try { out = { status: 'ok', data: c.fn(...ins.map((d) => d.data)) }; }
      catch (e) { console.error('calc', id, e); out = { status: 'error', data: null, message: e.message }; }
    }
    calcCache[id] = out;
    return out;
  }

  function data(id) { return calcs[id] ? calcData(id) : datasetData(id); }

  function drawName(name) {
    document.querySelectorAll('[data-draw="' + name + '"]').forEach((el) => {
      if (el.closest('[hidden]')) return;
      try { draws[name](el); } catch (e) { console.error('draw', name, e); }
    });
  }

  function redraw() {
    calcCache = {};
    onDataFns.forEach((f) => { try { f(); } catch (e) { console.error(e); } });
    Object.keys(draws).forEach(drawName);
  }

  async function fetchData(onlyTlt) {
    if (onlyTlt) raw.tlt = { status: 'loading' };
    redraw();
    let res;
    try {
      res = await fetch('/api/data?month=' + encodeURIComponent(params.month) + (onlyTlt ? '&only=tlt' : ''), { credentials: 'same-origin' });
    } catch (e) {
      setAll('error', '連不到伺服器，請檢查網路');
      return redraw();
    }
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { setAll('error', j.error || '讀取失敗'); return redraw(); }
    Object.entries(j.datasets || {}).forEach(([id, d]) => { raw[id] = { ...d }; });
    window.utLoadedAt && window.utLoadedAt(j.at);
    redraw();
  }

  function setAll(status, message) {
    Object.keys(raw).forEach((id) => { if (raw[id].status === 'loading') raw[id] = { status, message }; });
    ['tlt', 'coupon_issue', 'coupon_use'].forEach((id) => { if (!raw[id] || raw[id].status === 'loading') raw[id] = { status, message }; });
  }

  let resizeTimer;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(redraw, 150); });

  window.dash = {
    loader(id, def) { loaders[id] = def; },
    calc(id, def) { calcs[id] = def; },
    data,
    draw(name, fn) {
      if (fn) { draws[name] = typeof fn === 'function' ? fn : (el) => (fn.update || fn.mount)(el); }
      else drawName(name);
      if (fn && started) drawName(name);
    },
    onData(fn) { onDataFns.push(fn); if (started) fn(); },
    params() { return { ...params }; },
    setParams(p) {
      const monthChanged = 'month' in p && String(p.month) !== String(params.month);
      Object.entries(p).forEach(([k, v]) => { if (v === null || v === undefined) delete params[k]; else params[k] = v; });
      if (!params.month) params.month = '11';
      if (!started) return;
      if (monthChanged) fetchData(true); else redraw();
    },
    resetParams() { params = { month: params.month }; redraw(); },
    setLink(name) { try { history.replaceState(null, '', '#' + name); } catch (e) {} setTimeout(redraw, 0); },
    refresh() { fetchData(false); },
    colors: ['var(--lv1200)', 'var(--lv3400)', 'var(--lv6600)', 'var(--lv11000)', 'var(--lv21500)'],
  };

  window.utStart = function () {
    if (started) return fetchData(false);
    started = true;
    fetchData(false);
  };
})();
