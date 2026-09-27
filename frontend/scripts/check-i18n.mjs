#!/usr/bin/env node
// Guard for the i18n dictionaries (ISS-005).
//
// interpolate() in src/i18n/index.jsx only understands `{{var}}`. Any key written
// with a single brace (`{n}`) renders the literal text `{n}` to the user, which is
// exactly the bug this script exists to prevent from coming back.
//
//   node scripts/check-i18n.mjs
//
// Exits 1 (and prints every offender) when a key uses single braces, when a
// placeholder refers to a variable the key never receives is impossible to know
// here — so we only check syntax — or when ar/en disagree on the key set.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const langs = ['ar', 'en'];

function flatten(node, prefix = '', out = {}) {
  if (typeof node === 'string') {
    out[prefix] = node;
    return out;
  }
  if (node && typeof node === 'object') {
    for (const key of Object.keys(node)) flatten(node[key], prefix ? `${prefix}.${key}` : key, out);
  }
  return out;
}

let failed = false;

for (const lang of langs) {
  const file = path.join(root, 'src', 'i18n', `${lang}.json`);
  let dict;
  try {
    dict = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    console.error(`✗ ${lang}.json is not valid JSON: ${err.message}`);
    failed = true;
    continue;
  }

  const flat = flatten(dict);
  const offenders = [];
  for (const [key, value] of Object.entries(flat)) {
    const leftover = value.replace(/\{\{\s*\w+\s*\}\}/g, '').match(/\{\s*[a-zA-Z_][\w]*\s*\}/g);
    if (leftover) offenders.push({ key, leftover, value });
  }

  if (offenders.length) {
    failed = true;
    console.error(`✗ ${lang}: ${offenders.length} key(s) use single-brace placeholders (must be {{var}}):`);
    for (const o of offenders) console.error(`    ${o.key}  ${JSON.stringify(o.leftover)}  ->  ${o.value}`);
  } else {
    console.log(`✓ ${lang}: ${Object.keys(flat).length} keys, all placeholders are {{var}}`);
  }
}

// ar and en must expose the same keys, otherwise one language silently falls back.
const [ar, en] = langs.map((l) => {
  try {
    return flatten(JSON.parse(fs.readFileSync(path.join(root, 'src', 'i18n', `${l}.json`), 'utf8')));
  } catch {
    return {};
  }
});
const arKeys = new Set(Object.keys(ar));
const enKeys = new Set(Object.keys(en));
const onlyAr = [...arKeys].filter((k) => !enKeys.has(k));
const onlyEn = [...enKeys].filter((k) => !arKeys.has(k));
if (onlyAr.length || onlyEn.length) {
  failed = true;
  console.error(`✗ key sets differ — only ar: ${onlyAr.length}${onlyAr.length ? ` (${onlyAr.slice(0, 5).join(', ')})` : ''}`);
  console.error(`✗ key sets differ — only en: ${onlyEn.length}${onlyEn.length ? ` (${onlyEn.slice(0, 5).join(', ')})` : ''}`);
} else {
  console.log(`✓ ar and en expose the same ${arKeys.size} keys`);
}

process.exit(failed ? 1 : 0);
