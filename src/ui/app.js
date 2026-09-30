/**
 * App shell: owns UI state (what-if overrides, pinned baseline, last model),
 * wires DOM events by delegation, and boots the page.
 */
import { INTAKE_SCHEMA, ASSUME_SCHEMA } from './schema.js';
import { DEFAULT_ASSUMPTIONS } from '../engine/assumptions.js';
import { buildModel, defaultWhatIf } from '../engine/model.js';
import { fmt$ } from '../engine/format.js';
import { SAMPLE_CLIENT } from './sample-client.js';
import { renderSchema, addRow, gatherInputs, setInputs, downloadClientFile, readClientFile } from './form.js';
import { renderPlanHTML, drawCharts, snapshot } from './report.js';

const state = { whatIf: null, baseline: null, lastModel: null };
const $ = (id) => document.getElementById(id);

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 3200);
}

function showTab(tab) {
  document.querySelectorAll('nav.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tabpane').forEach((p) => p.classList.toggle('active', p.id === 'tab-' + tab));
  window.scrollTo(0, 0);
}

function generatePlan(fresh = true) {
  const inputs = gatherInputs();
  if (!inputs.c1_name) {
    toast('Enter at least Client 1’s name and core data — or load the sample client.');
    showTab('intake');
    return;
  }
  if (fresh || !state.whatIf) state.whatIf = defaultWhatIf(inputs);
  const M = buildModel(inputs, { whatIf: state.whatIf });
  state.lastModel = M;
  $('plan-root').innerHTML = renderPlanHTML(M, state);
  drawCharts(M);
  updateWhatIfLabels();
  if (fresh) showTab('plan');
}

/* ---------- what-if lab ---------- */
function readWhatIf() {
  return {
    retage: +$('wf_ret').value,
    extra: +$('wf_extra').value,
    spend: +$('wf_spend').value,
    eq: +$('wf_eq').value,
  };
}
function updateWhatIfLabels() {
  if (!$('wf_ret')) return;
  const w = readWhatIf();
  $('wf_ret_v').textContent = w.retage;
  $('wf_extra_v').textContent = fmt$(w.extra);
  $('wf_spend_v').textContent = w.spend > 0 ? fmt$(w.spend) : 'per intake';
  $('wf_eq_v').textContent = w.eq + '%';
}
function applyWhatIfChange() {
  state.whatIf = readWhatIf();
  const y = window.scrollY;
  generatePlan(false);
  window.scrollTo(0, y);
}

/* ---------- actions ---------- */
function loadSample({ quiet = false } = {}) {
  setInputs({ ...SAMPLE_CLIENT, ...DEFAULT_ASSUMPTIONS });
  if (!quiet) toast('Sample client loaded: the Whitmore household. Review the intake, then Generate.');
}

const ACTIONS = {
  'load-sample': () => loadSample(),
  'save-client': () => downloadClientFile(gatherInputs()),
  'open-client': () => $('loadfile').click(),
  'print': () => window.print(),
  'tab': (el) => showTab(el.dataset.tab),
  'generate': () => generatePlan(),
  'add-row': (el) => addRow(el.dataset.rows),
  'del-row': (el) => el.closest('tr').remove(),
  'toggle-section': (el) => el.parentElement.classList.toggle('collapsed'),
  'set-baseline': () => { if (state.lastModel) { state.baseline = snapshot(state.lastModel); generatePlan(false); } },
  'clear-baseline': () => { state.baseline = null; generatePlan(false); },
};

function wireEvents() {
  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-action]');
    if (el && ACTIONS[el.dataset.action]) ACTIONS[el.dataset.action](el, ev);
  });
  document.addEventListener('input', (ev) => {
    const t = ev.target;
    if (t.matches('[data-whatif]')) updateWhatIfLabels();
    if (t.dataset.rangeOut) $(t.dataset.rangeOut).textContent = t.value;
  });
  document.addEventListener('change', (ev) => {
    if (ev.target.matches('[data-whatif]')) applyWhatIfChange();
  });
  // Numeric fields show 0 by default; clear on focus so typing replaces it.
  document.addEventListener('focusin', (ev) => {
    if (ev.target.matches('[data-zero-clear]') && ev.target.value === '0') ev.target.value = '';
  });
  document.addEventListener('focusout', (ev) => {
    if (ev.target.matches('[data-zero-clear]') && ev.target.value === '') ev.target.value = '0';
  });
  $('loadfile').addEventListener('change', async (ev) => {
    const file = ev.target.files[0];
    ev.target.value = '';
    if (!file) return;
    try {
      setInputs(await readClientFile(file));
      toast('Client file loaded.');
    } catch (err) {
      toast('Could not read that file: ' + err.message);
    }
  });
}

function init() {
  renderSchema(INTAKE_SCHEMA, 'intake-root');
  renderSchema(ASSUME_SCHEMA, 'assume-root');
  setInputs(DEFAULT_ASSUMPTIONS);
  addRow('children');
  addRow('goals');
  wireEvents();
  // ?demo opens straight to a generated plan for the sample client.
  if (new URLSearchParams(location.search).has('demo')) {
    loadSample({ quiet: true });
    generatePlan();
  }
}

init();
