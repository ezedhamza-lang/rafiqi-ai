// READ-ONLY: which book cards are inert for the student?
//
// A card is inert only when the student has NO way in. The UI renders exactly three
// affordances in StudentBooks.jsx:
//   :150  the lessons button  <= book.lessonsCount > 0
//   :156  the browse button   <= book.hasImages
//   :165  the PDF button      <= book.hasPDF
// so "inert" = none of the three. Anything else is openable.
//
// The units column is reported but is NOT an access signal: `book.units` is never read
// by the frontend (a search of frontend/src finds no consumer), so units = 0 is
// metadata, not a dead end — the same reasoning as check-book-pages.mjs.
const BASE = process.env.AUDIT_API || 'http://localhost:3001';

// Books that are genuinely without content: no lessons file, no scan, no PDF. Tracked as
// a content gap (ISS-024) in docs/MASTER-ISSUES.md. The check stays green while the list
// is exactly this, and turns red the moment a SECOND book becomes unopenable.
const KNOWN_INERT = ['year4/anisi'];

const get = async (u) => {
  const r = await fetch(BASE + u);
  const t = await r.text();
  try { return { st: r.status, body: JSON.parse(t) }; } catch { return { st: r.status, body: t }; }
};

const books = (await get('/api/public/curriculum/books')).body;
const rows = [];
for (const b of books) {
  const lessons = await get(`/api/public/curriculum/books/${encodeURIComponent(b.gradeId)}/${encodeURIComponent(b.subjectId)}/lessons`);
  const arr = Array.isArray(lessons.body) ? lessons.body : [];
  const realLessons = arr.length;
  rows.push({
    key: `${b.gradeId}/${b.subjectId}`,
    title: b.title,
    advertised: b.lessonsCount,
    realLessons,
    hasImages: b.hasImages,
    hasPDF: !!b.hasPDF,
    units: (b.units || []).length,
    lessonsButton: b.lessonsCount > 0 ? 'YES' : 'hidden',
    browseButton: b.hasImages ? 'YES' : 'hidden',
    pdfButton: b.hasPDF ? 'YES' : 'hidden',
    cardOpens: b.lessonsCount > 0 || b.hasImages || b.hasPDF ? 'yes' : 'NOTHING'
  });
}

console.log('key                    advertised real  imgs  pdf units lessonsBtn browseBtn pdfBtn  card');
for (const r of rows) {
  console.log(
    `${r.key.padEnd(22)} ${String(r.advertised).padStart(9)} ${String(r.realLessons).padStart(4)} ${String(r.hasImages).padStart(5)} ${String(r.hasPDF).padStart(5)} ${String(r.units).padStart(5)}   ${r.lessonsButton.padEnd(10)} ${r.browseButton.padEnd(9)} ${r.pdfButton.padEnd(7)} ${r.cardOpens}`
  );
}

const mismatch = rows.filter((r) => r.realLessons > 0 && r.advertised === 0);
const inert = rows.filter((r) => r.cardOpens === 'NOTHING');
const noUnits = rows.filter((r) => r.units === 0 && r.realLessons > 0);

console.log(`\n=== MISMATCH: lessons exist but lessonsCount says 0 (button hidden) -> ${mismatch.length}/${rows.length} ===`);
mismatch.forEach((r) => console.log(`  ${r.key.padEnd(22)} ${r.title} — ${r.realLessons} hidden | images: ${r.hasImages}`));

console.log(`\n=== INERT CARDS: no button at all -> ${inert.length}/${rows.length} ===`);
inert.forEach((r) => console.log(`  ${r.key.padEnd(22)} ${r.title} — ${r.realLessons} lessons on the server | images: ${r.hasImages} | pdf: ${r.hasPDF}`));

console.log(`\n=== NO UNIT LIST but lessons exist -> ${noUnits.length}/${rows.length} ===`);
console.log('    (metadata only: book.units has no consumer in frontend/src, so this is NOT an access problem)');
noUnits.forEach((r) => console.log(`  ${r.key.padEnd(22)} ${r.title} — ${r.realLessons} lessons, units=0`));

// A mismatch means the catalogue lies to the UI; an inert card means a dead end. Both are
// defects unless the inert book is a documented content gap. A missing unit list is not.
const unexpectedInert = inert.filter((r) => !KNOWN_INERT.includes(r.key));
const documented = inert.filter((r) => KNOWN_INERT.includes(r.key));
console.log(`\ndocumented content gaps: ${documented.length} (${documented.map((r) => r.key).join(', ') || 'none'})`);
console.log(`unexpected inert cards : ${unexpectedInert.length}`);
if (mismatch.length || unexpectedInert.length) {
  process.exitCode = 1;
  if (mismatch.length) console.log('✗ the catalogue advertises a false zero — the lessons button stays hidden');
  unexpectedInert.forEach((r) => console.log(`✗ ${r.key} has no way in and is not a documented gap`));
} else {
  console.log('✓ no book advertises a false zero; every card without a way in is a documented content gap');
}
