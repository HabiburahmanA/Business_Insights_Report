'use strict';
/* ============================================================
   Black-box test of dist/app.min.js — the ACTUAL file that ships.
   No introspection into internals; everything happens through
   simulated DOM events, exactly like a real browser would drive it.
   ============================================================ */
const elementCache = new Map();
function makeFakeElement(id) {
  const children = [];
  const listeners = {};
  return {
    id, _innerHTML: '', _textContent: '', value: '', disabled: false, style: {}, dataset: {}, files: null,
    get textContent() { return this._textContent; },
    set textContent(v) { this._textContent = String(v); },
    classList: {
      _set: new Set(),
      add(c) { this._set.add(c); }, remove(c) { this._set.delete(c); },
      toggle(c, f) { if (f === undefined) this._set.has(c) ? this._set.delete(c) : this._set.add(c); else if (f) this._set.add(c); else this._set.delete(c); },
      contains(c) { return this._set.has(c); },
    },
    addEventListener(evt, cb) { (listeners[evt] = listeners[evt] || []).push(cb); },
    dispatch(evt, evtObj) { (listeners[evt] || []).forEach(cb => cb(evtObj || { target: this, preventDefault() {} })); },
    onclick: null,
    click() { this.dispatch('click'); if (this.onclick) this.onclick(); },
    get innerHTML() { return this._innerHTML; },
    set innerHTML(v) { this._innerHTML = v; children.length = 0; },
    appendChild(c) { children.push(c); },
    removeChild() {}, getContext() { return {}; }, closest() { return null; },
    querySelectorAll(sel) {
      if (sel.startsWith('.')) return children.filter(c => c.classList && c.classList.contains(sel.slice(1)));
      if (sel === '[data-filter-col]') return children.filter(c => c._isFilterSelect);
      return [];
    },
    get parentElement() { return makeFakeElement('parent-of-' + id); },
  };
}
class FakeChart { constructor() {} destroy() {} }
FakeChart.defaults = { font: {} };
const fakeStore = {};
global.localStorage = { getItem: k => (k in fakeStore ? fakeStore[k] : null), setItem: (k, v) => { fakeStore[k] = String(v); }, removeItem: k => { delete fakeStore[k]; } };
global.fetch = async (url) => ({ ok: true, json: async () => ({ text: '## Test\nOK' }) });
global.Chart = FakeChart;

// Papa mock: real CSV-text parsing (simple, no quoted-comma support needed for this test)
global.Papa = {
  parse(file, opts) {
    const text = file.__csvText;
    const lines = text.split('\n').filter(l => l.length);
    const rawHeaders = lines[0].split(',');
    const headers = rawHeaders.map((h, i) => (opts.transformHeader ? opts.transformHeader(h, i) : h.trim()));
    const data = lines.slice(1).map(line => {
      const cells = line.split(',');
      const row = {};
      headers.forEach((h, i) => { row[h] = cells[i] !== undefined ? cells[i] : ''; });
      return row;
    });
    setTimeout(() => opts.complete({ data, meta: { fields: headers }, errors: [] }), 0);
  },
};

let domContentLoadedCb = null;
global.window = global;
global.document = {
  getElementById: (id) => { if (!elementCache.has(id)) elementCache.set(id, makeFakeElement(id)); return elementCache.get(id); },
  querySelectorAll: (sel) => {
    if (sel === '.tab-btn') return [...elementCache.values()].filter(e => e._isTabBtn);
    if (sel === '.tab-panel') return [...elementCache.values()].filter(e => e._isTabPanel);
    if (sel === '[data-filter-col]') return [...elementCache.values()].filter(e => e._isFilterSelect);
    return [];
  },
  addEventListener: (evt, cb) => { if (evt === 'DOMContentLoaded') domContentLoadedCb = cb; },
  createElement: (tag) => makeFakeElement('created-' + Math.random()),
  body: makeFakeElement('body'),
};

// Pre-register the elements index.html actually provides, matching real structure.
const staticIds = ['loading-overlay', 'loading-text', 'sidebar', 'tab-nav', 'screen-context', 'ctx-description', 'ctx-domain',
  'ctx-domain-other', 'ctx-domain-other-wrap', 'ctx-expectations', 'btn-continue-context', 'screen-upload', 'upload-recap',
  'dropzone', 'file-input', 'upload-status', 'upload-error', 'btn-edit-context', 'screen-blank-error', 'blank-error-count',
  'blank-error-table-body', 'blank-error-log', 'blank-error-log-total', 'blank-error-log-note', 'blank-error-log-remaining',
  'btn-retry-upload', 'screen-dashboard', 'dataset-filename', 'dataset-count', 'btn-export', 'btn-replace', 'btn-clear',
  'filters-row-dynamic', 'btn-reset-filters', 'filter-note', 'tab-overview', 'tab-dataprofile', 'tab-trends', 'tab-categories',
  'tab-correlations', 'tab-insights'];
staticIds.forEach(id => elementCache.set(id, makeFakeElement(id)));
// Tag the 6 nav buttons / panels so the fake querySelectorAll('.tab-btn'/'.tab-panel') can find them, and give nav buttons dataset.tab
[['overview', 'tab-overview'], ['dataprofile', 'tab-dataprofile'], ['trends', 'tab-trends'], ['categories', 'tab-categories'], ['correlations', 'tab-correlations'], ['insights', 'tab-insights']]
  .forEach(([tab, panelId]) => {
    const btn = makeFakeElement('navbtn-' + tab); btn._isTabBtn = true; btn.dataset.tab = tab; btn.closest = (sel) => (sel === '.tab-btn' ? btn : null);
    elementCache.set('navbtn-' + tab, btn);
    elementCache.get(panelId)._isTabPanel = true;
  });
// tab-nav's own click listener uses e.target.closest('.tab-btn') — simulate by dispatching directly on tab-nav with a target
const tabNavEl = elementCache.get('tab-nav');
const realTabNavAdd = tabNavEl.addEventListener.bind(tabNavEl);

let failures = 0;
function check(label, cond) { if (cond) console.log(`  OK   ${label}`); else { console.log(`  FAIL ${label}`); failures++; } }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  require('fs').readFileSync(require('path').join(__dirname, '../dist/app.min.js'), 'utf8'); // sanity read
  require(require('path').join(__dirname, '../dist/app.min.js')); // executes the IIFE, registers DOMContentLoaded
  check('DOMContentLoaded listener was registered', typeof domContentLoadedCb === 'function');

  await domContentLoadedCb();
  await sleep(10);
  console.log('--- init() ran without throwing; context screen should be first (no saved data) ---');
  check('context screen is visible after init with no saved data', !elementCache.get('screen-context').classList.contains('hidden'));
  check('continue button starts disabled', elementCache.get('btn-continue-context').disabled === true);

  console.log('--- Filling business context form ---');
  elementCache.get('ctx-description').value = 'Retail order data for our online store';
  elementCache.get('ctx-description').dispatch('input');
  elementCache.get('ctx-domain').value = 'Retail / E-commerce';
  elementCache.get('ctx-domain').dispatch('change');
  elementCache.get('ctx-expectations').value = 'Revenue trends by region';
  elementCache.get('ctx-expectations').dispatch('input');
  check('continue button becomes enabled once all 3 fields are filled', elementCache.get('btn-continue-context').disabled === false);

  elementCache.get('btn-continue-context').click();
  await sleep(5);
  console.log('--- After clicking Continue: upload screen should show, with the recap filled in ---');
  check('upload screen visible', !elementCache.get('screen-upload').classList.contains('hidden'));
  check('context screen hidden', elementCache.get('screen-context').classList.contains('hidden'));
  check('recap mentions the chosen domain', /Retail/.test(elementCache.get('upload-recap').innerHTML));

  console.log('--- Uploading a clean CSV via the file input ---');
  const csvText = 'OrderID,OrderDate,Region,Revenue\n1,2024-01-05,North,100\n2,2024-02-10,South,200\n3,2024-03-15,East,150\n4,2024-04-01,West,175\n5,2024-05-12,North,225';
  const fakeFile = { name: 'orders.csv', type: 'text/csv', __csvText: csvText };
  elementCache.get('file-input').files = [fakeFile];
  elementCache.get('file-input').dispatch('change', { target: { files: [fakeFile] } });
  await sleep(20);

  check('dashboard screen visible after successful upload', !elementCache.get('screen-dashboard').classList.contains('hidden'));
  check('upload screen hidden', elementCache.get('screen-upload').classList.contains('hidden'));
  check('sidebar visible', !elementCache.get('sidebar').classList.contains('hidden'));
  check('filename shown', elementCache.get('dataset-filename').textContent === 'orders.csv');
  check('record count shown', /5 records/.test(elementCache.get('dataset-count').textContent));
  check('overview tab rendered real content', elementCache.get('tab-overview').innerHTML.length > 200);
  check('overview tab has no literal undefined/NaN', !/undefined|NaN/.test(elementCache.get('tab-overview').innerHTML));

  console.log('--- Switching to each tab via simulated nav clicks ---');
  for (const tab of ['dataprofile', 'trends', 'categories', 'correlations', 'insights']) {
    const btn = elementCache.get('navbtn-' + tab);
    tabNavEl.dispatch('click', { target: btn, preventDefault() {} });
    await sleep(5);
    const html = elementCache.get('tab-' + tab).innerHTML;
    check(`${tab} tab rendered on nav click`, html.length > 100 && !/undefined|NaN/.test(html));
  }

  console.log('--- Clearing data resets to a fresh context screen ---');
  elementCache.get('btn-clear').click();
  await sleep(10);
  check('clearing data returns to context screen', !elementCache.get('screen-context').classList.contains('hidden'));
  check('description field reset', elementCache.get('ctx-description').value === '');
  check('localStorage actually cleared', fakeStore['generic_report_v1'] === undefined);

  console.log('--- Re-uploading a file WITH blank cells triggers the gate, not the dashboard ---');
  elementCache.get('ctx-description').value = 'x'; elementCache.get('ctx-description').dispatch('input');
  elementCache.get('ctx-domain').value = 'Retail / E-commerce'; elementCache.get('ctx-domain').dispatch('change');
  elementCache.get('ctx-expectations').value = 'y'; elementCache.get('ctx-expectations').dispatch('input');
  elementCache.get('btn-continue-context').click();
  await sleep(5);
  const blankCsv = 'OrderID,Region,Revenue\n1,North,100\n2,,200\n3,East,';
  const blankFile = { name: 'bad.csv', type: 'text/csv', __csvText: blankCsv };
  elementCache.get('file-input').dispatch('change', { target: { files: [blankFile] } });
  await sleep(20);
  check('blank-error screen shown, not the dashboard', !elementCache.get('screen-blank-error').classList.contains('hidden'));
  check('dashboard NOT shown for a file with blanks', elementCache.get('screen-dashboard').classList.contains('hidden'));
  check('blank column count is correct (Region + Revenue)', elementCache.get('blank-error-count').textContent === '2');
  check('detailed log lists both occurrences', elementCache.get('blank-error-log-total').textContent === '2');
  const logHtml = elementCache.get('blank-error-log').innerHTML;
  check('log mentions row 3 (Region blank)', /Row 3/.test(logHtml) && /Region/.test(logHtml));
  check('log mentions row 4 (Revenue blank)', /Row 4/.test(logHtml) && /Revenue/.test(logHtml));

  console.log('\n' + (failures === 0 ? 'ALL BLACK-BOX TESTS PASSED ON THE MINIFIED BUNDLE' : `${failures} TEST(S) FAILED`));
  process.exit(failures === 0 ? 0 : 1);
}
run().catch(e => { console.log('FATAL: ' + e.stack); process.exit(1); });
