import { useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';

const LEVEL_SUGGESTIONS = [
  'السنة الأولى أساسي',
  'السنة الثانية أساسي',
  'السنة الثالثة أساسي',
  'السنة الرابعة أساسي',
  'السنة الخامسة أساسي',
  'السنة السادسة أساسي',
  'السنة الأولى ثانوي',
  'السنة الثانية ثانوي',
  'السنة الثالثة ثانوي'
];

export default function DirectorClasses() {
  const { t } = useI18n();
  const [stats, setStats] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [form, setForm] = useState({ name: '', level: '', teacherId: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = () => {
    api.get('/director/stats').then(setStats).catch(() => {});
    api.get('/director/teachers').then(setTeachers).catch(() => {});
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e) => {
    e.preventDefault();
    setMsg('');
    setErr('');
    if (!form.name.trim() || !form.level.trim()) {
      setErr('يرجى إدخال اسم القسم والمستوى');
      return;
    }
    setSaving(true);
    try {
      await api.post('/director/classes', {
        name: form.name.trim(),
        level: form.level.trim(),
        teacherId: form.teacherId ? Number(form.teacherId) : undefined
      });
      setForm({ name: '', level: '', teacherId: '' });
      setMsg('تم إنشاء القسم بنجاح — حدّث صفحة الطلبات ليظهر في قائمة الأقسام');
      load();
    } catch (ex) {
      setErr(ex.message || 'فشل إنشاء القسم');
    } finally {
      setSaving(false);
    }
  };

  if (!stats) return <div className="loading-wrap"><span className="spinner" /></div>;

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{t('directorClasses.title')}</h3>
      </div>

      <form onSubmit={create} style={{ marginBottom: '1.25rem', background: 'var(--primary-soft, #eef2ff)', padding: '1rem', borderRadius: '12px', display: 'grid', gap: '0.75rem' }}>
        <h4 style={{ margin: 0 }}>قسم جديد + إسناده لأستاذ</h4>
        <div className="form-group">
          <label>اسم القسم *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="مثال: قسم السنة السادسة"
          />
        </div>
        <div className="form-group">
          <label>المستوى *</label>
          <input
            type="text"
            list="class-levels"
            value={form.level}
            onChange={(e) => setForm({ ...form, level: e.target.value })}
            placeholder="مثال: السنة السادسة أساسي"
          />
          <datalist id="class-levels">
            {LEVEL_SUGGESTIONS.map((l) => (
              <option key={l} value={l} />
            ))}
          </datalist>
        </div>
        <div className="form-group">
          <label>الأستاذ المسؤول</label>
          <select value={form.teacherId} onChange={(e) => setForm({ ...form, teacherId: e.target.value })}>
            <option value="">-- بدون أستاذ (لاحقًا) --</option>
            {teachers.map((tc) => (
              <option key={tc.id} value={tc.id}>
                {tc.firstName} {tc.lastName} ({tc.email})
              </option>
            ))}
          </select>
        </div>
        {msg && <p className="form-success">{msg}</p>}
        {err && <p className="form-error">{err}</p>}
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'جاري الإنشاء...' : 'إنشاء القسم'}
        </button>
      </form>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('directorClasses.classColumn')}</th>
              <th>{t('directorClasses.levelColumn')}</th>
              <th>{t('directorClasses.studentsColumn')}</th>
              <th>{t('directorClasses.attemptsColumn')}</th>
              <th>{t('directorClasses.avgColumn')}</th>
              <th>{t('directorClasses.statusColumn')}</th>
            </tr>
          </thead>
          <tbody>
            {stats.perClass.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.level}</td>
                <td>{c.students}</td>
                <td>{c.attempts}</td>
                <td>{c.avgPercent}%</td>
                <td>
                  <span className={`badge ${c.avgPercent >= 70 ? 'good' : c.avgPercent >= 45 ? 'warn' : c.attempts === 0 ? '' : 'bad'}`}>
                    {c.attempts === 0
                      ? t('directorClasses.noActivity')
                      : c.avgPercent >= 70
                        ? t('directorClasses.active')
                        : c.avgPercent >= 45
                          ? t('directorClasses.lowActivity')
                          : t('directorClasses.weak')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
