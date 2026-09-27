// Dry-run + apply mojibake repair: UTF-8 bytes that were decoded as Windows-1252.
// Maps the CP1252 high range back to byte values, re-decodes the run as UTF-8, and
// only accepts the result when it contains no replacement characters.
import fs from 'fs';
import path from 'path';

const CP1252_HIGH = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85,
  0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a,
  0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92,
  0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c,
  0x017e: 0x9e, 0x0178: 0x9f
};

const toBytes = (str) => {
  const out = [];
  for (const ch of str) {
    const cp = ch.codePointAt(0);
    if (cp <= 0xff) out.push(cp);
    else if (CP1252_HIGH[cp] !== undefined) out.push(CP1252_HIGH[cp]);
    else return null; // not a cp1252 character
  }
  return Buffer.from(out);
};

// A run of characters that could be part of a mojibake sequence.
const RUN = /[ÂÃâ][-¿]|[-¿]{1,3}[‘’“”–—…•€™œžšž�ˆ-˙]|[-¿]{2,4}/g;
// Leading marker characters that start a decoded multi-byte sequence.
const START = /[ÂÃâ][-¿]?/;

function repairLine(line) {
  let out = '';
  let i = 0;
  let changed = false;
  while (i < line.length) {
    const m = START.exec(line.slice(i));
    if (!m || m.index !== 0) {
      out += line[i];
      i += 1;
      continue;
    }
    // take the longest run starting here that only uses cp1252-representable chars
    let j = i;
    while (j < line.length) {
      const cp = line.codePointAt(j);
      if (cp <= 0xff || CP1252_HIGH[cp] !== undefined) j += line.codePointAt(j) > 0xffff ? 2 : 1;
      else break;
    }
    const seg = line.slice(i, j);
    const bytes = toBytes(seg);
    if (bytes && bytes.length >= 2) {
      const fixed = bytes.toString('utf8');
      // accept only if it round-trips: no replacement char and it decodes cleanly
      if (!fixed.includes('\uFFFD') && Buffer.from(fixed, 'utf8').equals(bytes)) {
        out += fixed;
        changed = true;
        i = j;
        continue;
      }
    }
    out += line[i];
    i += 1;
  }
  return { text: out, changed };
}

const APPLY = process.argv.includes('--apply');
const ROOTS = ['src', 'public/games/knowledge-garden/src'];
const EXT = new Set(['.js', '.jsx', '.mjs', '.json', '.css', '.html']);
const SKIP = new Set(['node_modules', 'dist', '.git']);

let totalLines = 0;
const report = [];
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (EXT.has(path.extname(entry.name))) fixFile(full);
  }
}
function fixFile(file) {
  const original = fs.readFileSync(file, 'utf8');
  const eol = original.includes('\r\n') ? '\r\n' : '\n';
  const lines = original.split(/\r?\n/);
  let fileChanged = false;
  const fixedLines = lines.map((line, idx) => {
    const r = repairLine(line);
    if (!r.changed) return line;
    totalLines += 1;
    fileChanged = true;
    report.push(`${file}:${idx + 1}\n    - ${line.trim().slice(0, 96)}\n    + ${r.text.trim().slice(0, 96)}`);
    return r.text;
  });
  if (fileChanged && APPLY) {
    fs.writeFileSync(file, fixedLines.join(eol), 'utf8');
  }
}
ROOTS.forEach(walk);

console.log(`${APPLY ? 'APPLIED' : 'DRY-RUN'}: ${totalLines} line(s) would change\n`);
console.log(report.join('\n'));
