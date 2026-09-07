import { createElement } from 'react';

const NUM_RE = /\d+(?:[\s.,،]\d+)*/g;

export function bidiNodes(text) {
  if (text == null) return null;
  const s = String(text);
  const out = [];
  let last = 0;
  let k = 0;
  let m;
  NUM_RE.lastIndex = 0;
  while ((m = NUM_RE.exec(s)) !== null) {
    if (m.index > last) out.push(s.slice(last, m.index));
    out.push(createElement('span', { key: 'n' + k++, dir: 'ltr', style: { unicodeBidi: 'isolate' } }, m[0]));
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}
