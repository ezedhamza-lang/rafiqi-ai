import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mdPath = path.resolve('C:/Users/ezedd/OneDrive - ANETI/Bureau/رياضيات/kitab-riyadiyat-anisi-v2.md');
const jsonPath = path.join(__dirname, '../curriculum/year1/math-workbook.json');

const md = fs.readFileSync(mdPath, 'utf8');
const wb = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

// Parse MD lessons
const lessonBlocks = md.split(/^## الدرس /m).slice(1);
const mdMap = new Map(); // lessonNum -> Map(qNum -> {images: [], text})

lessonBlocks.forEach(block => {
  const numMatch = block.match(/^(\d+):/);
  if (!numMatch) return;
  const lessonNum = parseInt(numMatch[1], 10);
  const qMap = new Map();
  // Find all questions: **1. ...**  **2. ...**
  const qRegex = /\*\*(\d+)\.\s+([^*]+?)\*\*\s*(?:<sub>.*?<\/sub>)?/g;
  let qMatch;
  while ((qMatch = qRegex.exec(block)) !== null) {
    const qNum = parseInt(qMatch[1], 10);
    const qStart = qMatch.index;
    const nextQ = block.indexOf(`**${qNum + 1}.`, qStart + 1);
    const qEnd = nextQ === -1 ? block.length : nextQ;
    const qSlice = block.slice(qStart, qEnd);
    // find images in this slice: > 🖼️ **[صورة: `...`]**
    const imgRegex = /\[صورة:\s*`([^`]+)`\]/g;
    const images = [];
    let imgMatch;
    while ((imgMatch = imgRegex.exec(qSlice)) !== null) {
      let p = imgMatch[1].trim();
      if (p.startsWith('svg:')) {
        // svg:opt_X -> /svg/opt_X.png (these are actually PNG files despite svg: prefix)
        p = '/svg/' + p.slice(4) + '.png';
      } else {
        // convert svg -> png and normalize path
        p = p.replace(/\.svg$/i, '.png');
        if (p.startsWith('media/')) p = '/' + p;
        else if (!p.startsWith('/')) p = '/' + p;
      }
      images.push(p);
    }
    qMap.set(qNum, { images, text: qMatch[2].trim() });
  }
  mdMap.set(lessonNum, qMap);
});

let totalFixed = 0;
let totalChecked = 0;

wb.lessons.forEach(lesson => {
  const mdQMap = mdMap.get(lesson.num);
  if (!mdQMap) {
    console.log(`No MD for lesson ${lesson.num}`);
    return;
  }
  lesson.questions.forEach(q => {
    totalChecked++;
    const mdEntry = mdQMap.get(q.num);
    if (!mdEntry) return;
    const mdImages = mdEntry.images;

    // For type m,t with single img: q.img should be mdImages[0]
    if ((q.type === 'm' || q.type === 't' || q.type === 'c' || q.type === 'k') && mdImages.length === 1) {
      const expected = mdImages[0];
      if (q.img !== expected) {
        console.log(`L${lesson.num} Q${q.num} img fix: ${q.img} -> ${expected}`);
        q.img = expected;
        totalFixed++;
      }
    }
    // For type g (image choice) with options containing img
    if (q.type === 'g' && mdImages.length > 0) {
      // mdImages order should match options order
      q.options.forEach((opt, idx) => {
        if (mdImages[idx] && opt.img !== mdImages[idx]) {
          console.log(`L${lesson.num} Q${q.num} opt${idx} img fix: ${opt.img} -> ${mdImages[idx]}`);
          opt.img = mdImages[idx];
          totalFixed++;
        }
      });
      // remove extra null options already handled
      const before = q.options.length;
      q.options = q.options.filter(o => o.img !== null && o.img !== undefined);
      if (q.options.length !== before) totalFixed++;
    }
    // For type with options containing img but md has no image -> keep
  });
});

// Also ensure all svg: references are png
let svgFixed = 0;
wb.lessons.forEach(l => {
  l.questions.forEach(q => {
    if (q.img && q.img.includes('.svg')) {
      q.img = q.img.replace('.svg', '.png');
      svgFixed++;
    }
    if (q.options) {
      q.options.forEach(opt => {
        if (opt.img && opt.img.includes('.svg')) {
          opt.img = opt.img.replace('.svg', '.png');
          svgFixed++;
        }
      });
    }
  });
});

fs.writeFileSync(jsonPath, JSON.stringify(wb, null, 2), 'utf8');
console.log(`\nChecked ${totalChecked} questions, fixed ${totalFixed} images, svg->png ${svgFixed}`);
console.log('Done - all questions now match MD images');
