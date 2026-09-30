/** Display formatters shared by the rules engine and the report renderer. */

export const fmt$ = (n) => (n < 0 ? '-$' : '$') + Math.round(Math.abs(n)).toLocaleString('en-US');

export const fmtPct = (n, digits = 1) => (n * 100).toFixed(digits) + '%';

export const fmtK = (v) => Math.abs(v) >= 1e6 ? '$' + (v / 1e6).toFixed(1) + 'M' : '$' + (v / 1e3).toFixed(0) + 'k';

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escape free-text client input before it is interpolated into HTML. */
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
