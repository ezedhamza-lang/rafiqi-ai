import { useState, useEffect } from 'react';
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
  const [mode, setMode] = useState('bank'); // 'bank' or 'ai'
  const [form, setForm] = useState({
    gradeId: 'year1',
    subject: 'math',
    trimester: 3,
    schoolName: '',
    apiKey: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [apiKeyValid, setApiKeyValid] = useState(null);
  const [bankStats, setBankStats] = useState(null);
  const [generatedExam, setGeneratedExam] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editableQuestions, setEditableQuestions] = useState([]);

  const availableSubjects = form.gradeId === 'year1'
    ? SUBJECTS.filter(s => YEAR1_SUBJECTS.includes(s.code))
    : SUBJECTS;

  // تحميل إحصائيات البنك
  useEffect(() => {
    if (mode === 'bank') {
      loadBankStats();
    }
  }, [mode]);

  const loadBankStats = async () => {
    try {
      const token = localStorage.getItem('school_token');
      const res = await fetch('/api/teacher/exams/bank-stats', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBankStats(data);
      }
    } catch (e) {
      console.error('Failed to load bank stats:', e);
    }
  };

  // فحص مفتاح API
  const validateApiKey = async () => {
    if (!form.apiKey) return;
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('school_token');
      const res = await fetch('/api/teacher/exams/validate-api-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ apiKey: form.apiKey })
      });
      const data = await res.json();
      setApiKeyValid(data.valid);
      if (!data.valid) {
        setError('مفتاح API غير صالح');
      }
    } catch (e) {
      setApiKeyValid(false);
      setError('خطأ في فحص المفتاح');
    } finally {
      setLoading(false);
    }
  };

  // توليد الاختبار من البنك
  const generateFromBank = async (format = 'docx') => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const body = {
        gradeId: form.gradeId,
        subject: form.subject,
        trimester: form.trimester,
        schoolName: form.schoolName || undefined,
        format
      };

      const token = localStorage.getItem('school_token');
      const res = await fetch('/api/teacher/exams/generate-from-bank', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      if (format === 'docx') {
        const blob = await res.blob();
        downloadBlob(blob, `اختبار_${form.subject}_${form.gradeId}_T${form.trimester}.docx`);
        setSuccess('تم تحميل الملف بنجاح');
      } else {
        const data = await res.json();
        setGeneratedExam(data);
        setEditableQuestions(data.questions || []);
        setEditMode(true);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // توليد بالذكاء الاصطناعي
  const generateWithAI = async (format = 'docx') => {
    if (!form.apiKey) {
      setError('مفتاح API مطلوب');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const body = {
        apiKey: form.apiKey,
        gradeId: form.gradeId,
        subject: form.subject,
        trimester: form.trimester,
        schoolName: form.schoolName || undefined,
        format
      };

      const token = localStorage.getItem('school_token');
      const res = await fetch('/api/teacher/exams/generate-with-ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      if (format === 'docx') {
        const blob = await res.blob();
        downloadBlob(blob, `اختبار_${form.subject}_${form.gradeId}_T${form.trimester}_AI.docx`);
        setSuccess('تم تحميل الملف بنجاح');
      } else {
        const data = await res.json();
        setGeneratedExam(data);
        setEditableQuestions(data.questions || []);
        setEditMode(true);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // تحميل الملف
  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // تعديل السؤال
  const updateQuestion = (index, field, value) => {
    const updated = [...editableQuestions];
    updated[index] = { ...updated[index], [field]: value };
    setEditableQuestions(updated);
  };

  // حذف سؤال
  const removeQuestion = (index) => {
    setEditableQuestions(editableQuestions.filter((_, i) => i !== index));
  };

  // إضافة سؤال جديد
  const addQuestion = () => {
    setEditableQuestions([...editableQuestions, {
      id: `custom-${Date.now()}`,
      criteria: 'مع1',
      subCriterion: 'مع1أ',
      type: 'MCQ',
      content: '',
      answer: '',
      options: ['', '', ''],
      points: 2,
      freeLines: 3
    }]);
  };

  // إعادة التوليد بعد التعديل
  const regenerateDocx = async () => {
    setLoading(true);
    try {
      const exam = {
        ...generatedExam,
        questions: editableQuestions,
        gradeId: form.gradeId,
        subject: form.subject,
        trimester: form.trimester,
        criteria: groupQuestionsByCriteria(editableQuestions),
        totalScore: editableQuestions.reduce((sum, q) => sum + (q.points || 0), 0)
      };

      const token = localStorage.getItem('school_token');
      const res = await fetch('/api/teacher/exams/generate-official', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...exam,
          format: 'docx',
          schoolName: form.schoolName
        })
      });

      if (!res.ok) throw new Error('خطأ في توليد الملف');

      const blob = await res.blob();
      downloadBlob(blob, `اختبار_${form.subject}_${form.gradeId}_T${form.trimester}_معدل.docx`);
      setSuccess('تم تحميل الملف المعدل بنجاح');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // تجميع الأسئلة حسب المعايير
  function groupQuestionsByCriteria(questions) {
    const groups = {};
    for (const q of questions) {
      const code = q.criteria || 'مع1';
      if (!groups[code]) {
        groups[code] = { code, label: code, max: 0, subCriteria: [] };
      }
      groups[code].max += q.points || 0;
    }
    return Object.values(groups);
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>توليد اختبار رسمي (Word)</h3>
      </div>

      {error && <div className="form-error">{error}</div>}
      {success && <div className="form-success" style={{ color: 'green', padding: '8px 0' }}>{success}</div>}

      {/* اختيار الوضع */}
      <div className="card-form" style={{ marginBottom: 16 }}>
        <div className="form-row">
          <button
            className={`btn ${mode === 'bank' ? 'btn-primary' : ''}`}
            onClick={() => setMode('bank')}
            style={{ flex: 1 }}
          >
            بنك الأسئلة (اوفلاين)
          </button>
          <button
            className={`btn ${mode === 'ai' ? 'btn-primary' : ''}`}
            onClick={() => setMode('ai')}
            style={{ flex: 1 }}
          >
            بالذكاء الاصطناعي (AI)
          </button>
        </div>
      </div>

      {/* إعدادات الاختبار */}
      <div className="card-form">
        <div className="form-row">
          <div className="form-group">
            <label>المستوى الدراسي</label>
            <select
              value={form.gradeId}
              onChange={(e) => setForm({
                ...form,
                gradeId: e.target.value,
                subject: e.target.value === 'year1' && !YEAR1_SUBJECTS.includes(form.subject)
                  ? 'reading' : form.subject
              })}
            >
              {LEVELS.map(l => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>المادة</label>
            <select
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
            >
              {availableSubjects.map(s => (
                <option key={s.code} value={s.code}>{s.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>الثلاثي</label>
            <select
              value={form.trimester}
              onChange={(e) => setForm({ ...form, trimester: Number(e.target.value) })}
            >
              <option value={1}>الأوّل</option>
              <option value={2}>الثّاني</option>
              <option value={3}>الثّالث</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group grow">
            <label>اسم المدرسة (اختياري)</label>
            <input
              value={form.schoolName}
              onChange={(e) => setForm({ ...form, schoolName: e.target.value })}
              placeholder="مدرسة المعرفة"
            />
          </div>
        </div>

        {/* وضع الذكاء الاصطناعي */}
        {mode === 'ai' && (
          <div className="form-row" style={{ marginTop: 12 }}>
            <div className="form-group grow">
              <label>مفتاح Gemini API</label>
              <input
                type="password"
                value={form.apiKey}
                onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                placeholder="AIza..."
              />
              <small style={{ color: '#666' }}>
                احصل على المفتاح من{' '}
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">
                  Google AI Studio
                </a>
              </small>
            </div>
            <div className="form-group" style={{ alignSelf: 'flex-end' }}>
              <button
                className="btn"
                onClick={validateApiKey}
                disabled={loading || !form.apiKey}
              >
                فحص المفتاح
              </button>
            </div>
            {apiKeyValid !== null && (
              <div style={{ color: apiKeyValid ? 'green' : 'red', marginTop: 4 }}>
                {apiKeyValid ? 'المفتاح صالح' : 'المفتاح غير صالح'}
              </div>
            )}
          </div>
        )}

        {/* إحصائيات البنك */}
        {mode === 'bank' && bankStats && (
          <div style={{ marginTop: 12, padding: '8px 12px', background: '#f5f5f5', borderRadius: 6 }}>
            <strong>البنك:</strong> {bankStats.combinations?.length || 0} مادة/سنة/ثلاثي متاح
          </div>
        )}

        <div className="btn-group" style={{ marginTop: 16 }}>
          {mode === 'bank' ? (
            <>
              <button
                className="btn btn-primary"
                onClick={() => generateFromBank('docx')}
                disabled={loading}
              >
                {loading ? 'جاري التوليد...' : 'تحميل من البنك (Word)'}
              </button>
              <button
                className="btn"
                onClick={() => generateFromBank('json')}
                disabled={loading}
              >
                معاينة وتعديل
              </button>
            </>
          ) : (
            <>
              <button
                className="btn btn-primary"
                onClick={() => generateWithAI('docx')}
                disabled={loading || !form.apiKey}
              >
                {loading ? 'جاري التوليد بالذكاء الاصطناعي...' : 'توليد بالذكاء الاصطناعي (Word)'}
              </button>
              <button
                className="btn"
                onClick={() => generateWithAI('json')}
                disabled={loading || !form.apiKey}
              >
                معاينة وتعديل
              </button>
            </>
          )}
          <button
            className="btn"
            onClick={() => {
              if (confirm('هل تريد إعادة ضبط البنك؟ سيتم السماح باستخدام الأسئلة المستخدمة مسبقاً')) {
                fetch('/api/teacher/exams/reset-bank', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('school_token')}`
                  }
                }).then(() => {
                  setSuccess('تم إعادة ضبط البنك');
                  loadBankStats();
                });
              }
            }}
          >
            إعادة ضبط البنك
          </button>
        </div>
      </div>

      {/* وضع التعديل */}
      {editMode && editableQuestions.length > 0 && (
        <div className="card-form" style={{ marginTop: 16 }}>
          <h4>تعديل الأسئلة قبل التحميل</h4>
          <p style={{ color: '#666', marginBottom: 12 }}>
            يمكنك تعديل أو حذف أو إضافة أسئلة قبل تحميل الملف النهائي
          </p>

          {editableQuestions.map((q, idx) => (
            <div key={q.id} style={{
              border: '1px solid #ddd',
              borderRadius: 8,
              padding: 12,
              marginBottom: 12,
              background: '#fafafa'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <strong>سؤال {idx + 1}</strong>
                <button
                  className="btn"
                  style={{ color: 'red', padding: '2px 8px' }}
                  onClick={() => removeQuestion(idx)}
                >
                  حذف
                </button>
              </div>

              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label>المعيار</label>
                  <input
                    value={q.criteria}
                    onChange={(e) => updateQuestion(idx, 'criteria', e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>التجزئة</label>
                  <input
                    value={q.subCriterion}
                    onChange={(e) => updateQuestion(idx, 'subCriterion', e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>النوع</label>
                  <select
                    value={q.type}
                    onChange={(e) => updateQuestion(idx, 'type', e.target.value)}
                  >
                    <option value="MCQ">اختيار من متعدد</option>
                    <option value="TRUE_FALSE">صواب/خطأ</option>
                    <option value="FILL_BLANK">إكمال</option>
                    <option value="FREE">سؤال حر</option>
                    <option value="VERTICAL_OP">عملية عمودية</option>
                    <option value="COIN">قطع نقدية</option>
                    <option value="MATCHING">ربط</option>
                  </select>
                </div>
                <div className="form-group" style={{ flex: 0.5 }}>
                  <label>النقاط</label>
                  <input
                    type="number"
                    value={q.points}
                    onChange={(e) => updateQuestion(idx, 'points', Number(e.target.value))}
                    min="0.5"
                    step="0.5"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>نص السؤال</label>
                <textarea
                  value={q.content}
                  onChange={(e) => updateQuestion(idx, 'content', e.target.value)}
                  rows={2}
                  style={{ width: '100%' }}
                />
              </div>

              {q.type === 'MCQ' && (
                <div className="form-row">
                  {q.options.map((opt, optIdx) => (
                    <div key={optIdx} className="form-group" style={{ flex: 1 }}>
                      <label>خيار {optIdx + 1}</label>
                      <input
                        value={opt}
                        onChange={(e) => {
                          const newOptions = [...q.options];
                          newOptions[optIdx] = e.target.value;
                          updateQuestion(idx, 'options', newOptions);
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="form-group">
                <label>الإجابة</label>
                <input
                  value={q.answer}
                  onChange={(e) => updateQuestion(idx, 'answer', e.target.value)}
                />
              </div>
            </div>
          ))}

          <div className="btn-group" style={{ marginTop: 12 }}>
            <button className="btn btn-primary" onClick={addQuestion}>
              + إضافة سؤال
            </button>
            <button className="btn btn-primary" onClick={regenerateDocx} disabled={loading}>
              {loading ? 'جاري التوليد...' : 'تحميل الملف المعدل (Word)'}
            </button>
            <button className="btn" onClick={() => setEditMode(false)}>
              إلغاء التعديل
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
