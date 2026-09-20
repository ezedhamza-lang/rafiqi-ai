import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let bank = null;
let links = null;

export function loadOfficialMemos() {
  if (!bank) {
    const raw = fs.readFileSync(
      path.join(__dirname, '../../content/banks/official-memos-bank.json'),
      'utf8'
    );
    bank = JSON.parse(raw).memos || [];
  }
  return bank;
}

export function loadOfficialLinks() {
  if (!links) {
    const raw = fs.readFileSync(
      path.join(__dirname, '../../content/banks/official-memo-links.json'),
      'utf8'
    );
    links = JSON.parse(raw).links || {};
  }
  return links;
}

export function normalizeMemoText(s) {
  return String(s || '')
    .replace(/[ً-ٰٟ]/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .toLowerCase()
    .replace(/[^ء-غف-ي0-9a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function subjectOf(subject) {
  const n = normalizeMemoText(subject);
  if (/رياض/.test(n)) return 'math';
  if (/ايقاظ|علوم|موقظ/.test(n)) return 'science';
  return null;
}

function isYear2(level) {
  const n = normalizeMemoText(level);
  return /السنة الثانية|سنة 2|year\s*2|2eme|2ème/.test(n) || /ثانية/.test(n);
}

export function getOfficialMemoById(id) {
  if (!id || typeof id !== 'string') return null;
  const clean = id.trim();
  if (!/^y2-(math|science)-\d+(-\d+)?$/.test(clean)) return null;
  return loadOfficialMemos().find((e) => e.id === clean) || null;
}

export function listOfficialMemos({ subject, level } = {}) {
  let all = loadOfficialMemos();
  if (subject) {
    const subj = subjectOf(subject);
    if (!subj) return [];
    all = all.filter((e) => e.subject === subj);
  }
  if (level) {
    if (!isYear2(level)) return [];
    all = all.filter((e) => e.level === 'year2');
  }
  return all.map((e) => ({
    id: e.id,
    level: e.level,
    subject: e.subject,
    subjectSeq: e.subjectSeq,
    topic: e.topic,
    timingMinutes: e.timingMinutes,
    source: e.source
  }));
}

export function matchOfficialMemo({ subject, level, lessonTitle }) {
  const subj = subjectOf(subject);
  if (!subj || !isYear2(level)) return null;
  const hit = loadOfficialLinks()[normalizeMemoText(lessonTitle)];
  if (!hit) return null;
  const entry = loadOfficialMemos().find((e) => e.id === hit);
  if (!entry || entry.subject !== subj) return null;
  return entry;
}

export function buildOfficialMemoContent(entry, ctx, lesson) {
  const isMath = entry.subject === 'math';
  const headerColumns = ['المستوى', 'المادة', 'التوقيت', 'مكوّن الكفاية', 'الهدف المميّز', 'المحتوى', 'هدف الحصّة'];
  const tableColumns = ['المراحل', 'نشاط المعلّم', 'نشاط المتعلّم', 'الوسائل'];
  const phases = entry.stages.map((s) => ({
    name: s.name,
    goal: '',
    activities: [...s.teacher.split('\n'), ...s.learner.split('\n')].map((a) => a.trim()).filter(Boolean).slice(0, 10),
    notes: []
  }));
  const rows = entry.stages.map((s) => ({
    stage: s.name,
    teacherActivity: s.teacher,
    learnerActivity: s.learner,
    tools: s.tools,
    skill: '',
    teacherActivityShort: '',
    learnerActivityShort: ''
  }));
  const spec = {
    specVersion: 2,
    mathTemplate: isMath,
    banner: {
      duration: `التوقيت: ${entry.timingMinutes} دق`,
      title: isMath ? 'مذكرة رياضيات' : 'مذكرة إيقاظ علمي',
      level: ctx.level || ''
    },
    headerTitle: `مذكرة بيداغوجية لحصة ${isMath ? 'رياضيات' : 'إيقاظ علمي'} — ${ctx.level || ''}`,
    period: lesson.period ? String(lesson.period).padStart(2, '0') : ctx.level,
    competencies: isMath
      ? { domain: 'حلّ وضعيات مشكلة دالّة.', component: entry.competency, distinctiveObjective: entry.objective }
      : {
          domain: 'مجال العلوم والتكنولوجيا',
          subject: 'الإيقاظ العلمي',
          component: entry.competency,
          distinctiveObjective: entry.objective
        },
    content: entry.content,
    lessonObjectives: [entry.lessonGoal],
    rows,
    specRows: rows.length,
    successRateLine: 'نسبة نجاح الدرس من خلال التمرين التطبيقي: ',
    pedagogicalDecision: 'القرار البيداغوجي: ',
    decisionHints: '',
    officialRef: entry.id,
    officialTopic: entry.topic
  };
  return {
    methodologyId: `official-y2-${entry.subject}`,
    methodologyTitle: `مذكرة رسمية — ${entry.topic}`,
    principle: '',
    subject: ctx.subject,
    level: ctx.level,
    lessonTitle: lesson.title,
    lessonType: ctx.lessonType || '',
    unit: ctx.unit || '',
    domain: lesson.domain || lesson.chapter || '',
    header: {
      columns: headerColumns,
      values: {
        المستوى: ctx.level,
        المادة: ctx.subject,
        التوقيت: `${entry.timingMinutes} دق`,
        'مكوّن الكفاية': entry.competency,
        'الهدف المميّز': entry.objective,
        المحتوى: entry.content,
        'هدف الحصّة': entry.lessonGoal
      }
    },
    warmup: [],
    phases,
    table: { columns: tableColumns, rows: rows.map((r) => ({
      المراحل: r.stage,
      'نشاط المعلّم': r.teacherActivity,
      'نشاط المتعلّم': r.learnerActivity,
      الوسائل: (r.tools || []).join(' + ')
    })) },
    closing: [],
    domainNotes: [],
    keywords: [],
    definitions: [],
    source: 'official',
    sourceBook: ctx.sourceBook || 'كتاب المذكرات الرسمي — السنة الثانية 2026-2027',
    officialRef: entry.id,
    officialTopic: entry.topic,
    spec,
    sourceText: `${entry.topic}\n${entry.competency}`.slice(0, 3000)
  };
}
