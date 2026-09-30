/**
 * Intake form: renders the schema into inputs, and converts between the DOM
 * and the plain `inputs` object the engine consumes.
 *
 * No inline event handlers — interactive elements carry data-action
 * attributes and are wired up by delegation in app.js.
 */
import { ALL_FIELDS, ROW_SCHEMAS, isNumericField } from './schema.js';
import { esc } from '../engine/format.js';

function renderField(f) {
  if (f.type === 'subhead') return `<div class="subhead">${f.text}</div>`;
  if (f.type === 'rows') {
    const ths = f.cols.map((c) => `<th>${c.label}</th>`).join('') + '<th></th>';
    return `<div class="rowlist field wide"><label>${f.label}</label>
      <table id="rows_${f.id}"><thead><tr>${ths}</tr></thead><tbody></tbody></table>
      <button type="button" class="addrow" data-action="add-row" data-rows="${f.id}">+ Add Row</button></div>`;
  }
  const help = f.help ? `<div class="help">${f.help}</div>` : '';
  let input;
  if (f.type === 'select') {
    input = `<select id="${f.id}">${f.options.map((o) => `<option>${o}</option>`).join('')}</select>`;
  } else if (f.type === 'range') {
    input = `<input type="range" id="${f.id}" min="${f.min}" max="${f.max}" value="5" data-range-out="${f.id}_out"> <b id="${f.id}_out">5</b>`;
  } else if (isNumericField(f)) {
    input = `<input type="number" id="${f.id}" value="0" step="any" data-zero-clear>`;
  } else {
    input = `<input type="text" id="${f.id}" value="">`;
  }
  return `<div class="field"><label for="${f.id}">${f.label}</label>${input}${help}</div>`;
}

export function renderSchema(schema, rootId) {
  document.getElementById(rootId).innerHTML = schema.map((sec) => `
    <div class="sec" id="sec_${sec.id}">
      <h2 data-action="toggle-section">${sec.title}<span class="chev">&#9660;</span></h2>
      <div class="sec-body"><div class="grid">${sec.fields.map(renderField).join('')}</div></div>
    </div>`).join('');
}

export function addRow(id, data = {}) {
  const tb = document.querySelector(`#rows_${id} tbody`);
  const tr = document.createElement('tr');
  tr.innerHTML = ROW_SCHEMAS[id].map((c) => {
    const v = data[c.id] !== undefined ? data[c.id] : (c.type === 'num' ? 0 : '');
    if (c.type === 'select') {
      return `<td><select data-col="${c.id}">${c.options.map((o) => `<option ${o === v ? 'selected' : ''}>${o}</option>`).join('')}</select></td>`;
    }
    return `<td><input type="${c.type === 'num' ? 'number' : 'text'}" data-col="${c.id}" value="${esc(v)}"></td>`;
  }).join('') + '<td><button type="button" class="del" data-action="del-row" aria-label="Remove row">×</button></td>';
  tb.appendChild(tr);
}

function readRows(id) {
  return [...document.querySelectorAll(`#rows_${id} tbody tr`)].map((tr) => {
    const o = {};
    tr.querySelectorAll('[data-col]').forEach((el) => { o[el.dataset.col] = el.type === 'number' ? (+el.value || 0) : el.value; });
    return o;
  });
}

/** Read every form field into a plain inputs object. */
export function gatherInputs() {
  const d = {};
  for (const f of ALL_FIELDS) {
    if (f.type === 'rows') { d[f.id] = readRows(f.id); continue; }
    const el = document.getElementById(f.id);
    if (!el) continue;
    d[f.id] = isNumericField(f) ? (+el.value || 0) : el.value;
  }
  return d;
}

/** Populate the form from an inputs object (fields absent from `d` are left alone). */
export function setInputs(d) {
  for (const f of ALL_FIELDS) {
    if (f.type === 'rows') {
      document.querySelector(`#rows_${f.id} tbody`).innerHTML = '';
      (d[f.id] || []).forEach((r) => addRow(f.id, r));
      continue;
    }
    const el = document.getElementById(f.id);
    if (!el || d[f.id] === undefined) continue;
    el.value = d[f.id];
    if (f.type === 'range') {
      const out = document.getElementById(f.id + '_out');
      if (out) out.textContent = d[f.id];
    }
  }
}

export function downloadClientFile(d) {
  const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (d.c1_name || 'client').replace(/\s+/g, '_') + '_plan_data.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 0);
}

export function readClientFile(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = (e) => {
      try { resolve(JSON.parse(e.target.result)); } catch (err) { reject(err); }
    };
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });
}
