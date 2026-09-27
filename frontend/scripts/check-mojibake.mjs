#!/usr/bin/env node
// Guard against mojibake: source text that was written as UTF-8 bytes but decoded
// as Windows-1252, so "café" or an emoji turn into a run of accented Latin letters.
//
// Signature: a lead byte character (U+00C2 / U+00C3 / U+00E2) immediately followed by
// characters in the C1 block or the CP1252 punctuation range (U+0080-U+017F).
//
//   node scripts/check-mojibake.mjs
//
// Exits 1 when a hit is in live code. Hits inside comments are reported but do not
// fail the check: they are invisible to users, and the affected lines are CSS section
// headers in src/index.css that were mangled by an old editor long ago.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOTS = ['src', 'public/games/knowledge-garden/src'];
const EXT = new Set(['.js', '.jsx', '.mjs', '.cjs', '.json', '.css', '.html']);
const SKIP = new Set(['node_modules', 'dist', '.git', 'scripts']);

const PATTERNS = [
  /[\u00c3][\u0080-\u017f]/,
  /[\u00e2][\u0080-\u017f]{1,3}/,
  /[\u00c2][\u0080-\u017f]/,
  /\u00ef\u00bb\u00bf/, // UTF-8 BOM decoded as text
  /\u00e2\u20ac/
];

/** True when the line is (part of) a comment: CSS /* *\/, JS // , or * ... */
function isCommentLine(line, inBlockComment) {
  const trimmed = line.trim();
  if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return true;
  if (inBlockComment) return true;
  // a trailing comment on a code line: everything after an unescaped /* or //
  const idx = line.search(/\/\*|\/\//);
  return idx >= 0;
}

const codeHits = [];
const commentHits = [];

function record(file, line, text, inComment) {
  const hit = PATTERNS.map((p) => text.match(p)).find(Boolean);
  if (!hit) return;
  const entry = {
    file: path.relative(ROOT, file).replace(/\\/g, '/'),
    line,
    col: text.indexOf(hit[0]) + 1,
    sample: hit[0],
    text: text.trim().slice(0, 100)
  };
  (inComment ? commentHits : codeHits).push(entry);
}

function scan(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const isCss = path.extname(file) === '.css';
  if (isCss) {
    // In CSS a mangled comment can hide its own delimiters, so strip /* ... */
    // first and only judge what is left. Offsets inside a comment are meaningless,
    // so only the snippet is reported for comment hits.
    const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '));
    stripped.split(/\r?\n/).forEach((line, i) => record(file, i + 1, line, false));
    const commentBlocks = raw.match(/\/\*[\s\S]*?\*\//g) || [];
    for (const block of commentBlocks) {
      for (const part of block.split(/\r?\n/)) {
        const hit = PATTERNS.map((p) => part.match(p)).find(Boolean);
        if (hit) {
          commentHits.push({
            file: path.relative(ROOT, file).replace(/\\/g, '/'),
            line: 0,
            col: 0,
            sample: hit[0],
            text: part.trim().slice(0, 100)
          });
        }
      }
    }
    return;
  }
  let inBlock = false;
  raw.split(/\r?\n/).forEach((line, i) => {
    record(file, i + 1, line, isCommentLine(line, inBlock));
    const open = (line.match(/\/\*/g) || []).length;
    const close = (line.match(/\*\//g) || []).length;
    if (open > close) inBlock = true;
    else if (close >= open) inBlock = false;
  });
}

function walk(dir) {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) return;
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const p = path.join(full, entry.name);
    if (entry.isDirectory()) walk(path.relative(ROOT, p));
    else if (EXT.has(path.extname(entry.name))) scan(p);
  }
}
ROOTS.forEach(walk);

if (codeHits.length) {
  console.error(`✗ ${codeHits.length} mojibake sequence(s) in live code:\n`);
  for (const h of codeHits) {
    console.error(`  ${h.file}${h.line ? ':' + h.line + ':' + h.col : ''}  ${JSON.stringify(h.sample)}`);
    console.error(`      ${h.text}`);
  }
  console.error('\nRepair with:  node scripts/fix-mojibake.mjs --apply');
  process.exit(1);
}

console.log('✓ no mojibake in live code');
if (commentHits.length) {
  const files = [...new Set(commentHits.map((h) => h.file))].join(', ');
  console.log(`  (${commentHits.length} pre-existing hits inside comments, invisible to users: ${files})`);
}
