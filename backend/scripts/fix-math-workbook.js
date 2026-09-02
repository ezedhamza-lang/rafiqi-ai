import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const file = path.join(__dirname, '../curriculum/year1/math-workbook.json');
const raw = fs.readFileSync(file, 'utf8');
const wb = JSON.parse(raw);

let fixes = 0;

// Fix 1: Q06 left mismatch for lessons 1-5 (position lessons)
const q06Fix = {
  1: { left: ['القط وراء الطاولة', 'القط أمام الطاولة'] },
  3: { left: ['القط على يمين الطاولة', 'القط على يسار الطاولة'] },
  4: { left: ['القط بجانب الطاولة', 'القط على يمين الطاولة'] },
  5: { left: ['القط داخل الصندوق', 'القط خارج الصندوق'] },
};

wb.lessons.forEach(l => {
  if (q06Fix[l.num]) {
    const q = l.questions.find(x => x.num === 6);
    if (q && q.left) {
      q.left = q06Fix[l.num].left;
      fixes++;
    }
  }
  // Fix 2: Q02 type for lessons 2,3,4,5 should be "t" not "g"
  if ([2,3,4,5].includes(l.num)) {
    const q = l.questions.find(x => x.num === 2);
    if (q && q.type === 'g') {
      q.type = 't';
      q.options = ['صحيح ✅', 'خطأ ❌'];
      q.answer = 1; // الطفل يقف فوق/بجانب/داخل الشجرة - هذه الصور تظهر الطفل بجانب الشجرة وليس فوقها، الإجابة خطأ لتمييز المفهوم
      // keep img
      fixes++;
    }
  }
  // Fix 3: remove null img entries in Q03 options
  l.questions.forEach(q => {
    if (q.options && Array.isArray(q.options)) {
      const before = q.options.length;
      q.options = q.options.filter(o => !(o && typeof o === 'object' && o.img === null));
      if (q.options.length !== before) fixes++;
    }
  });
  // Fix 4: add easy-answer flag and notebook for write types
  l.questions.forEach(q => {
    // Mark questions that need notebook paper for 6yo
    if (['w','c','f','a','k'].includes(q.type) && !q.options) {
      q.useNotebook = true;
      q.notebookHint = 'اكتب إجابتك هنا بيدك على ورقة الكراس';
    }
    // For match (M) type - convert to easy for 6yo: keep but ensure large tap targets via frontend
    if (q.type === 'M') {
      q.easyMode = true;
    }
  });
});

fs.writeFileSync(file, JSON.stringify(wb, null, 2), 'utf8');
console.log(`Fixed ${fixes} issues, total lessons ${wb.lessons.length}`);
console.log('Done');
