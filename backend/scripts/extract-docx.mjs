// استخراج نص docx (zip + word/document.xml)
import fs from 'fs';
import AdmZip from 'adm-zip';

const file = process.argv[2];
const zip = new AdmZip(file);
const xml = zip.readAsText('word/document.xml');
// فقرات
const paras = [...xml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)].map((m) =>
  m[0]
    .replace(/<w:tab[^>]*\/>/g, '\t')
    .replace(/<[^>]+>/g, '')
    .trim()
);
console.log(paras.filter(Boolean).join('\n'));