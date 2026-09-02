import { useState } from 'react';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';

const LEVELS = [
  { code: 'year1', label: 'السنة الأولى' },
  { code: 'year2', label: 'السنة الثانية' },
  { code: 'year3', label: 'السنة الثالثة' },
  { code: 'year4', label: 'السنة الرابعة' },
  { code: 'year5', label: 'السنة الخامسة' },
  { code: 'year6', label: 'السنة السادسة' }
];

const SUBJECTS = [
  { code: 'math', label: 'الرياضيات' },
  { code: 'reading', label: 'القراءة' },
  { code: 'science', label: 'الإيقاظ العلمي' },
  { code: 'production', label: 'الإنتاج الكتابي' },
  { code: 'handwriting', label: 'الخط والإملاء' },
  { code: 'grammar', label: 'قواعد اللغة' },
  { code: 'french', label: 'اللغة الفرنسية' },
  { code: 'english', label: 'اللغة الإنجليزية' },
  { code: 'islamic', label: 'التربية الإسلامية' },
  { code: 'civics', label: 'التربية المدنية' },
  { code: 'technology', label: 'التكنولوجيا' },
  { code: 'ict', label: 'المعلوماتية' },
  { code: 'art', label: 'التربية التشكيلية' },
  { code: 'music', label: 'التربية الموسيقية' },
  { code: 'pe', label: 'التربية البدنية' }
];

const YEAR1_SUBJECTS = ['reading', 'math', 'science', 'production', 'handwriting'];

export default function OfficialExamGenerator({ classes }) {
  const { t } = useI18n();
  const [form, setForm] = useState({ gradeId: 'year1', subject: 'math', trimester: 1, schoolName: '', seed: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const availableSubjects = form.gradeId === 'year1' ? SUBJECTS.filter(s => YEAR1_SUBJECTS.includes(s.code)) : SUBJECTS;

  const downloadDocx = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const body = {
        gradeId: form.gradeId,
        subject: form.subject,
        trimester: Number(form.trimester),
        schoolName: form.schoolName || undefined,
        seed: form.seed || undefined,
        format: 'docx'
      };

      const token = localStorage.getItem('school_token');
      const res = await fetch('/api/teacher/exams/generate-official', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const subjectLabel = availableSubjects.find(s => s.code === form.subject)?.label || form.subject;
      const levelLabel = LEVELS.find(l => l.code === form.gradeId)?.label || form.gradeId;
      a.download = `اختبار_${subjectLabel}_${levelLabel}_T${form.trimester}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setSuccess('تم تحميل الملف بنجاح');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const generatePreview = async () => {
    setLoading(true);
    setError('');
    try {
      const body = {
        gradeId: form.gradeId,
        subject: form.subject,
        trimester: Number(form.trimester),
        schoolName: form.schoolName || undefined,
        seed: form.seed || undefined,
        format: 'html'
      };

      const token = localStorage.getItem('school_token');
      const res = await fetch('/api/teacher/exams/generate-official', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const html = await res.text();
      const w = window.open('', '_blank', 'width=800,height=600');
      w.document.write(html);
      w.document.close();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>توليد اختبار رسمي (Word)</h3>
      </div>

      {error && <div className="form-error">{error}</div>}
      {success && <div className="form-success" style={{ color: 'green', padding: '8px 0' }}>{success}</div>}

      <div className="card-form">
        <div className="form-row">
          <div className="form-group">
            <label>المستوى الدراسي</label>
            <select value={form.gradeId} onChange={(e) => setForm({ ...form, gradeId: e.target.value, subject: e.target.value === 'year1' ? (YEAR1_SUBJECTS.includes(form.subject) ? form.subject : 'reading') : form.subject })}>
              {LEVELS.map(l => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>المادة</label>
            <select value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}>
              {availableSubjects.map(s => (
                <option key={s.code} value={s.code}>{s.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>الثلاثي</label>
            <select value={form.trimester} onChange={(e) => setForm({ ...form, trimester: e.target.value })}>
              <option value={1}>الأوّل</option>
              <option value={2}>الثّاني</option>
              <option value={3}>الثّالث</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group grow">
            <label>اسم المدرسة (اختياري)</label>
            <input value={form.schoolName} onChange={(e) => setForm({ ...form, schoolName: e.target.value })} placeholder="مدرسة المعرفة" />
          </div>
          <div className="form-group">
            <label>البذرة (اختياري — لإعادة نفس الامتحان)</label>
            <input value={form.seed} onChange={(e) => setForm({ ...form, seed: e.target.value })} placeholder="test-123" />
          </div>
        </div>

        <div className="btn-group" style={{ marginTop: 16 }}>
          <button className="btn btn-primary" onClick={downloadDocx} disabled={loading}>
            {loading ? 'جاري التحميل...' : 'تحميل ملف Word'}
          </button>
          <button className="btn" onClick={generatePreview} disabled={loading}>
            معاينة في المتصفح
          </button>
        </div>
      </div>
    </div>
  );
}
