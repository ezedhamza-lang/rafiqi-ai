import JSZip from 'jszip';

/* ══════════════════════════════════════════════════════════════════
   MEMO DOCX SERVICE — builds editable Word (.docx) memos
   Matching official templates from "D:\livres eleves\مثال فارغ لمذكرات":
     Table 0: Banner (التوقيت | العنوان | المستوى)
     Table 1: Competency (empty | label) × 4 rows
     Table 2: Activity (المراحل | نشاط المعلّم | نشاط المتعلّم | الوسائل)
     Bottom: نسبة النجاح + القرار البيداغوجي
   No watermark — fully editable.
   ══════════════════════════════════════════════════════════════════ */

const FONT_TITLE = 'Traditional Arabic';
const FONT_BODY = 'Sakkal Majalla';

const NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

function el(tag, attrs = '', children = '') {
  const a = attrs ? ' ' + attrs : '';
  if (!children) return `<w:${tag}${a}/>`;
  return `<w:${tag}${a}>${children}</w:${tag}>`;
}

function run(text, opts = {}) {
  if (!text) return '';
  const rPr = [];
  if (opts.bold) rPr.push(el('b'));
  if (opts.sz) rPr.push(el('sz', `w:val="${opts.sz}"`));
  if (opts.font) rPr.push(el('rFonts', `w:ascii="${opts.font}" w:hAnsi="${opts.font}" w:cs="${opts.font}"`));
  const rPrXml = rPr.length ? el('rPr', '', rPr.join('')) : '';
  const safe = String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return el('r', '', rPrXml + el('t', '', safe));
}

function para(runs, opts = {}) {
  const pPr = [];
  if (opts.align) pPr.push(el('jc', `w:val="${opts.align}"`));
  if (opts.after !== undefined) pPr.push(el('spacing', `w:after="${opts.after}"`));
  if (opts.before !== undefined) pPr.push(el('spacing', `w:before="${opts.before}"`));
  const pPrXml = pPr.length ? el('pPr', '', pPr.join('')) : '';
  return el('p', '', pPrXml + (Array.isArray(runs) ? runs.join('') : runs));
}

function cellBorder() {
  return el('tcBorders', '',
    el('top', 'w:val="single" w:sz="6" w:space="0" w:color="000000"') +
    el('bottom', 'w:val="single" w:sz="6" w:space="0" w:color="000000"') +
    el('start', 'w:val="single" w:sz="6" w:space="0" w:color="000000"') +
    el('end', 'w:val="single" w:sz="6" w:space="0" w:color="000000"')
  );
}

function tcW(widthPct) {
  return el('tcW', `w:w="${Math.round(widthPct * 50)}" w:type="pct"`);
}

function tcBorders() { return cellBorder(); }

function gridSpan(n) {
  return n > 1 ? el('gridSpan', `w:val="${n}"`) : '';
}

function vAlign(align) {
  return el('vAlign', `w:val="${align}"`);
}

function cell(content, widthPct, opts = {}) {
  const tcPr = [tcW(widthPct), cellBorder()];
  if (opts.shading) tcPr.push(el('shd', `w:val="clear" w:color="auto" w:fill="${opts.shading}"`));
  if (opts.span) tcPr.push(gridSpan(opts.span));
  tcPr.push(vAlign('center'));
  const tc = el('tc', '', tcPr.join('') + content);
  return tc;
}

function cellEmpty(widthPct) {
  return cell(para([run('')]), widthPct);
}

function cellLabel(text, widthPct, opts = {}) {
  return cell(para([run(text, { bold: true, sz: 24, ...opts })]), widthPct, { shading: 'E8F5E2' });
}

function cellDots(widthPct, count = 4) {
  const dots = '.'.repeat(60);
  const lines = [];
  for (let i = 0; i < count; i++) {
    lines.push(para([run(dots, { sz: 22 })], { after: 20 }));
  }
  return cell(lines.join(''), widthPct);
}

function row(cells) {
  return el('tr', '', cells.join(''));
}

function table(rows, tblPr = '') {
  return el('tbl', '', tblPr + rows.join(''));
}

function tblPrDefault() {
  return el('tblPr', '',
    el('tblStyle', 'w:val="TableGrid"') +
    el('tblW', 'w:w="5000" w:type="pct"') +
    el('tblLayout', 'w:val="fixed"') +
    el('tblLook', 'w:val="04A0"')
  );
}

function emptyPara() {
  return para('');
}

/* ══════════════════════════════════════════════════════════════════
   BUILD TABLES
   ══════════════════════════════════════════════════════════════════ */

function buildBannerTable(duration, title, level) {
  const r = row([
    cell(para([run(duration, { bold: true, sz: 28 })], { align: 'center' }), 33, { shading: 'F5EDD6' }),
    cell(para([run(title, { bold: true, sz: 34 })], { align: 'center' }), 34, { shading: 'E8DFC4' }),
    cell(para([run(level, { bold: true, sz: 28 })], { align: 'center' }), 33, { shading: 'F5EDD6' })
  ]);
  return table([r]);
}

function buildCompetencyTable(compDefs) {
  const rows = [];
  for (const [label, value] of compDefs) {
    const valText = value || '.'.repeat(80);
    rows.push(row([
      cell(para([run('', { sz: 24 })]), 20),
      cell(para([run(label + ' : ', { bold: true, sz: 26 })]), 22, { shading: 'E8F5E2' }),
      cell(para([run(valText, { sz: 24 })]), 58)
    ]));
  }
  return table(rows);
}

function buildActivityHeader() {
  const headers = ['المراحل', 'نشاط المعلّم', 'نشاط المتعلّم', 'الوسائل'];
  const widths = [15, 38, 32, 15];
  const colors = ['D9B45B', 'A8C8E8', 'A9DCB9', 'D3BCE8'];
  return row(headers.map((h, i) =>
    cell(para([run(h, { bold: true, sz: 28 })], { align: 'center' }), widths[i], { shading: colors[i] })
  ));
}

function buildActivityRow(r, stageIdx) {
  const stageColors = ['F3E2B6', 'C9DEF3', 'CDEED4', 'E6D4F5', 'F8D4C8', 'D4ECEC'];
  const bgColor = stageColors[stageIdx % stageColors.length];

  const teacherLines = (r.teacherActivity || '').split('\n').filter(Boolean);
  const teacherContent = teacherLines.map((l) => para([run(l, { sz: 22 })], { after: 20 })).join('');

  const learnerLines = (r.learnerActivity || '').split('\n').filter(Boolean);
  const learnerContent = learnerLines.map((l) => para([run(l, { sz: 22 })], { after: 20 })).join('');

  const tools = (r.tools || []).join(' + ') || '—';

  return row([
    cell(para([run(r.stage || '', { bold: true, sz: 26 })], { align: 'center' }), 15, { shading: bgColor }),
    cell(teacherContent || para([run('', { sz: 22 })]), 38),
    cell(learnerContent || para([run('', { sz: 22 })]), 32),
    cell(para([run(tools, { sz: 22 })], { align: 'center' }), 15)
  ]);
}

function buildBottomSection(successRate, decision) {
  const parts = [];
  parts.push(emptyPara());
  parts.push(para([run(successRate || 'نسبة نجاح الدرس من خلال التمرين التطبيقي:', { bold: true, sz: 26 })], { after: 100 }));
  parts.push(para([run('_'.repeat(70), { sz: 22 })], { after: 100 }));
  parts.push(para([run(decision || 'القرار البيداغوجي:', { bold: true, sz: 26 })], { after: 100 }));
  parts.push(para([run('_'.repeat(70), { sz: 22 })], { after: 100 }));
  parts.push(para([run('_'.repeat(70), { sz: 22 })]));
  return parts.join('');
}

/* ══════════════════════════════════════════════════════════════════
   BUILD DOCUMENT XML
   ══════════════════════════════════════════════════════════════════ */

function buildDocumentXml(bodyContent) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
            xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
            xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
            xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
            xmlns:v="urn:schemas-microsoft-com:vml"
            xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
            xmlns:w10="urn:schemas-microsoft-com:office:word"
            xmlns:w="${NS}"
            xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
            xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"
            xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk"
            xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml"
            xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"
            mc:Ignorable="w14">
  <w:body>
    ${bodyContent}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="720" w:footer="720" w:gutter="0"/>
      <w:cols w:space="720"/>
      <w:docGrid w:linePitch="360"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

function buildStyles() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="${NS}">
  <w:docDefaults>
    <w:rPrDefault><w:rPr>
      <w:rFonts w:ascii="${FONT_BODY}" w:hAnsi="${FONT_BODY}" w:cs="${FONT_BODY}"/>
      <w:sz w:val="28"/><w:szCs w:val="28"/>
      <w:lang w:val="ar-TN" w:bidi="ar-SA"/>
    </w:rPr></w:rPrDefault>
    <w:pPrDefault><w:pPr>
      <w:jc w:val="right"/>
      <w:rPr><w:rFonts w:ascii="${FONT_BODY}" w:hAnsi="${FONT_BODY}" w:cs="${FONT_BODY}"/></w:rPr>
    </w:pPr></w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:rPr><w:rFonts w:ascii="${FONT_BODY}" w:hAnsi="${FONT_BODY}" w:cs="${FONT_BODY}"/><w:sz w:val="28"/><w:szCs w:val="28"/><w:rtl/><w:lang w:val="ar-TN" w:bidi="ar-SA"/></w:rPr>
  </w:style>
  <w:style w:type="table" w:default="1" w:styleId="TableGrid">
    <w:name w:val="Table Grid"/>
    <w:basedOn w:val="TableNormal"/>
    <w:tblPr>
      <w:tblBorders>
        <w:top w:val="single" w:sz="6" w:space="0" w:color="000000"/>
        <w:start w:val="single" w:sz="6" w:space="0" w:color="000000"/>
        <w:bottom w:val="single" w:sz="6" w:space="0" w:color="000000"/>
        <w:end w:val="single" w:sz="6" w:space="0" w:color="000000"/>
        <w:insideH w:val="single" w:sz="6" w:space="0" w:color="000000"/>
        <w:insideV w:val="single" w:sz="6" w:space="0" w:color="000000"/>
      </w:tblBorders>
    </w:tblPr>
  </w:style>
  <w:style w:type="table" w:default="1" w:styleId="TableNormal">
    <w:name w:val="Normal Table"/>
    <w:tblPr>
      <w:tblInd w:w="0" w:type="dxa"/>
      <w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:start w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:end w:w="108" w:type="dxa"/></w:tblCellMar>
    </w:tblPr>
  </w:style>
</w:styles>`;
}

function buildFontTable() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:fonts xmlns:w="${NS}">
  <w:font w:name="${FONT_TITLE}"><w:charset w:val="178"/><w:family w:val="auto"/><w:pitch w:val="variable"/></w:font>
  <w:font w:name="${FONT_BODY}"><w:charset w:val="178"/><w:family w:val="auto"/><w:pitch w:val="variable"/></w:font>
</w:fonts>`;
}

function buildContentTypes() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/fontTable.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml"/>
</Types>`;
}

function buildRels() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
}

function buildDocRels() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/fontTable" Target="fontTable.xml"/>
</Relationships>`;
}

/* ══════════════════════════════════════════════════════════════════
   MAIN EXPORT
   ══════════════════════════════════════════════════════════════════ */

export async function buildMemoDocx(memo) {
  let c = memo.content;
  if (typeof c === 'string') { try { c = JSON.parse(c); } catch { c = {}; } }
  c = c || {};

  const s = c.spec || {};
  const isMath = s.mathTemplate;

  // ── Banner ──
  const duration = (s.banner && s.banner.duration) || (isMath ? 'التوقيت: 60 دق' : 'التوقيت : 30 دق');
  const title = (s.banner && s.banner.title) || (isMath ? 'مذكرة رياضيات' : 'مذكرة ' + (c.subjectWord || ''));
  const level = isMath
    ? ((s.banner && s.banner.level) || '')
    : ('المستوى : ' + (s.period || '…'));

  // ── Competency ──
  const compDefs = isMath
    ? [
        ['مكون الكفاية', s.competencies?.component],
        ['الهدف الم瑕疵', s.competencies?.distinctiveObjective],
        ['المحتوى', s.content],
        ['هدف الحصة', (s.lessonObjectives || []).join('؛ ')]
      ]
    : [
        ['كفاية المجال', s.competencies?.domain],
        ['كفاية المادة', s.competencies?.subject],
        ['مكوّن الكفاية', s.competencies?.component],
        ['الهدف المميّز', s.competencies?.distinctiveObjective],
        ['المحتوى', s.content],
        ['هدف الحصة', (s.lessonObjectives || []).join('؛ ')]
      ];

  // ── Activity rows ──
  const actRows = (s.rows || []).map((r, i) => buildActivityRow(r, i));

  // ── Assemble body ──
  const bodyParts = [];
  bodyParts.push(buildBannerTable(duration, title, level));
  bodyParts.push(emptyPara());
  bodyParts.push(buildCompetencyTable(compDefs));
  bodyParts.push(emptyPara());
  bodyParts.push(table([buildActivityHeader(), ...actRows]));
  bodyParts.push(buildBottomSection(s.successRateLine, s.pedagogicalDecision));

  const bodyXml = bodyParts.join('\n');
  const documentXml = buildDocumentXml(bodyXml);

  const zip = new JSZip();
  zip.file('[Content_Types].xml', buildContentTypes());
  zip.file('_rels/.rels', buildRels());
  zip.file('word/_rels/document.xml.rels', buildDocRels());
  zip.file('word/document.xml', documentXml);
  zip.file('word/styles.xml', buildStyles());
  zip.file('word/fontTable.xml', buildFontTable());

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
