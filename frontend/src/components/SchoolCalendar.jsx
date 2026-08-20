import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../i18n/index.jsx';
import { formatDate as fmtDate } from '../utils/formatUtils.js';
import { CALENDAR_TYPE_KEYS, CALENDAR_TYPE_ICONS, CALENDAR_TYPE_LABEL_KEYS, CALENDAR_AUDIENCE_KEYS, CALENDAR_AUDIENCE_LABEL_KEYS } from '../roles.js';

const MONTHS_AR = ['جانفي', 'فيفري', 'مارس', 'أفريل', 'ماي', 'جوان', 'جويلية', 'أوت', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

export default function SchoolCalendar({ manageable = false }) {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const [events, setEvents] = useState([]);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', type: 'OTHER', date: '', level: '', audience: 'ALL' });

  const canManage = manageable || (user && ['SCHOOL_DIRECTOR', 'ADMIN', 'SUPER_ADMIN', 'TEACHER'].includes(user.role));

  const load = useCallback(() => {
    api
      .get('/calendar/events')
      .then(setEvents)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (e) => {
    e.preventDefault();
    setError('');
    setMsg('');
    if (!form.title || !form.date) return setError('العنوان والتاريخ مطلوبان');
    try {
      await api.post('/calendar', form);
      setMsg('تمت إضافة الحدث إلى التقويم المدرسي');
      setShowForm(false);
      setForm({ title: '', description: '', type: 'OTHER', date: '', level: '', audience: 'ALL' });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (ev) => {
    if (!window.confirm(`حذف الحدث «${ev.title}»؟`)) return;
    try {
      await api.del(`/calendar/${ev.id}`);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const grouped = events.reduce((acc, ev) => {
    const d = new Date(ev.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(ev);
    return acc;
  }, {});
  const monthKeys = Object.keys(grouped).sort().reverse();

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>التقويم المدرسي الموحّد</h3>
        <p className="muted">عطل، اختبارات، اجتماعات وأنشطة — يظهر لكل دور حسب ما يخصه.</p>
      </div>

      {error && <div className="form-error" style={{ marginBottom: '0.8rem' }}>{error}</div>}
      {msg && <div className="form-success" style={{ marginBottom: '0.8rem' }}>{msg}</div>}

      {canManage && (
        <button className="btn btn-primary" style={{ marginBottom: '1rem' }} onClick={() => setShowForm((s) => !s)}>
          <span className="material-icons">{showForm ? 'close' : 'add'}</span>
          {showForm ? 'إلغاء' : 'إضافة حدث'}
        </button>
      )}

      {canManage && showForm && (
        <form className="card-form" onSubmit={create}>
          <div className="form-row">
            <div className="form-group grow">
              <label>العنوان *</label>
              <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="مثال: اختبارات الثلاثي الثاني" />
            </div>
            <div className="form-group">
              <label>التاريخ *</label>
              <input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="form-group">
              <label>النوع</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {CALENDAR_TYPE_KEYS.map((k) => (
                  <option key={k} value={k}>{t(CALENDAR_TYPE_LABEL_KEYS[k])}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group grow">
              <label>الوصف</label>
              <textarea rows="2" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="form-group">
              <label>المستوى (اختياري)</label>
              <input value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} placeholder="السنة الأولى أساسي" />
            </div>
            <div className="form-group">
              <label>الجمهور</label>
              <select value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}>
                {CALENDAR_AUDIENCE_KEYS.map((k) => (
                  <option key={k} value={k}>{t(CALENDAR_AUDIENCE_LABEL_KEYS[k])}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row">
            <button className="btn btn-primary" type="submit">حفظ الحدث</button>
          </div>
        </form>
      )}

      {monthKeys.length === 0 ? (
        <div className="empty">لا توجد أحداث بعد.</div>
      ) : (
        monthKeys.map((mk) => {
          const [y, m] = mk.split('-').map((n) => parseInt(n, 10));
          return (
            <div key={mk} style={{ marginBottom: '1.2rem' }}>
              <h4 style={{ marginBottom: '0.5rem' }}>{MONTHS_AR[m - 1]} {y}</h4>
              <div className="cards-grid">
                {grouped[mk].map((ev) => (
                  <div key={ev.id} className="card-item">
                    <div className="panel-head">
                      <span className="material-icons" style={{ fontSize: '1.6rem' }}>{CALENDAR_TYPE_ICONS[ev.type] || 'event'}</span>
                      <div>
                        <strong>{fmtDate(ev.date, lang)}</strong>
                        <span className="badge badge-chip">{CALENDAR_TYPE_LABEL_KEYS[ev.type] ? t(CALENDAR_TYPE_LABEL_KEYS[ev.type]) : ev.type}</span>
                      </div>
                    </div>
                    <h4>{ev.title}</h4>
                    {ev.description && <p className="muted">{ev.description}</p>}
                    {ev.level && <p className="muted">المستوى: {ev.level}</p>}
                    <p className="muted">الجمهور: {CALENDAR_AUDIENCE_LABEL_KEYS[ev.audience] ? t(CALENDAR_AUDIENCE_LABEL_KEYS[ev.audience]) : ev.audience}</p>
                    {canManage && (
                      <button className="btn btn-danger btn-sm" onClick={() => remove(ev)}>
                        <span className="material-icons">delete</span> حذف
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
