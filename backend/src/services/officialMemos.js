import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let bank = null;
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

function memoTokens(s) {
  return normalizeMemoText(s)
    .split(' ')
    .filter(Boolean)
    .map((t) => t.replace(/^[وفبكل]+(.{2,})$/, '$1'))
    .filter((t) => t.length > 1);
}

function matchScore(requestTitle, topic) {
  const A = new Set(memoTokens(requestTitle));
  const B = new Set(memoTokens(topic));
  if (!A.size || !B.size) return { inter: 0, cont: 0 };
  let inter = 0;
  for (const t of B) if (A.has(t)) inter++;
  return { inter, cont: inter / Math.min(A.size, B.size) };
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

export function matchOfficialMemo({ subject, level, lessonTitle }) {
  const subj = subjectOf(subject);
  if (!subj || !isYear2(level)) return null;
  let best = null;
  let bestKey = null;
  for (const entry of loadOfficialMemos()) {
    if (entry.subject !== subj || entry.level !== 'year2') continue;
    const sc = matchScore(lessonTitle, entry.topic);
    if (sc.cont >= 0.6 && sc.inter >= 2) {
      const contentScore = matchScore(lessonTitle, `${entry.objective} ${entry.content} ${entry.lessonGoal}`);
      const key = [sc.cont, sc.inter, contentScore.cont, contentScore.inter];
      if (!bestKey || compareKeys(key, bestKey) > 0) {
        best = entry;
        bestKey = key;
      }
    }
  }
  return best;
}

function compareKeys(a, b) {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
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
      level: `المستوى: ${ctx.level}`
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
