import fs from 'fs';
const F1 = 'curriculum/year5/reading-units.json';
const F2 = 'curriculum/year3/math-units.json';
let t = fs.readFileSync(F1, 'utf8');
const reps1 = [
  ['"ال节假日"', '"حقيبة"'],
  ['"جلس و观看"', '"جلس يشاهد"'],
  ['"بصفع وanger"', '"ببرود وإعراض"'],
  ['السعادة في الانتباه وال传染病 والصدق', 'السعادة في الانتباه واليقظة والصدق'],
  ['البيتisten场所，حبّ البيت والاعتناء به سعادة的人生。', 'البيتُ مأوى الإنسان، حبُّ البيت والاعتناء به سعادةُ المرء.'],
  ['"ال父母"', '"الوالدان"']
];
for (const [a, b] of reps1) t = t.split(a).join(b);
fs.writeFileSync(F1, t);
let t2 = fs.readFileSync(F2, 'utf8');
t2 = t2.split('الرفوف.見て').join('الرفوف.تأمّل');
fs.writeFileSync(F2, t2);
const re = /[\u3040-\u30FF\u4E00-\u9FFF]|isten|anger/g;
console.log('year5 remaining:', (t.match(re) || []).length);
console.log('year3 remaining:', (t2.match(re) || []).length);
JSON.parse(fs.readFileSync(F1, 'utf8'));
JSON.parse(fs.readFileSync(F2, 'utf8'));
console.log('JSON valid');
