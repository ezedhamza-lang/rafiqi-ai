import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';

const EMPTY = { allergies: '', chronicConditions: '', emergencyPhone: '', bloodType: '', notes: '' };

export default function ParentHealth() {
  const { t } = useI18n();
  const [children, setChildren] = useState([]);
  const [sel, setSel] = useState('');
  const [form, setForm] = useState(EMPTY);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api
      .get('/parent/health')
      .then((list) => {
        setChildren(list);
        if (list.length) {
          setSel(String(list[0].studentId));
          const rec = list[0].record;
          setForm({
            allergies: rec?.allergies || '',
            chronicConditions: rec?.chronicConditions || '',
            emergencyPhone: rec?.emergencyPhone || '',
            bloodType: rec?.bloodType || '',
            notes: rec?.notes || ''
          });
        }
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selectChild = (studentId) => {
    setSel(String(studentId));
    const child = children.find((c) => String(c.studentId) === String(studentId));
    const rec = child?.record;
    setForm({
      allergies: rec?.allergies || '',
      chronicConditions: rec?.chronicConditions || '',
      emergencyPhone: rec?.emergencyPhone || '',
      bloodType: rec?.bloodType || '',
      notes: rec?.notes || ''
    });
  };

  const save = async (e) => {
    e.preventDefault();
    setError('');
    setMsg('');
    try {
      await api.put(`/parent/health/${sel}`, form);
      setMsg(t('parentHealth.saved'));
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const current = children.find((c) => String(c.studentId) === String(sel));

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{t('parentHealth.title')}</h3>
        <p className="muted">
          {t('parentHealth.subtitle')}
        </p>
      </div>

      {error && <div className="form-error" style={{ marginBottom: '0.8rem' }}>{error}</div>}
      {msg && <div className="form-success" style={{ marginBottom: '0.8rem' }}>{msg}</div>}

      {children.length === 0 ? (
        <div className="empty">{t('parentHealth.noChild')}</div>
      ) : (
        <>
          <div className="form-row">
            <div className="form-group">
              <label>{t('parentHealth.child')}</label>
              <select value={sel} onChange={(e) => selectChild(e.target.value)}>
                {children.map((c) => (
                  <option key={c.studentId} value={c.studentId}>{c.firstName} {c.lastName}</option>
                ))}
              </select>
            </div>
            {current?.className && (
              <div className="form-group">
                <label>{t('parentHealth.class')}</label>
                <input value={current.className} disabled />
              </div>
            )}
          </div>

          <form className="card-form" onSubmit={save}>
            <div className="form-row">
              <div className="form-group grow">
                <label>{t('parentHealth.allergies')}</label>
                <input value={form.allergies} onChange={(e) => setForm({ ...form, allergies: e.target.value })} placeholder={t('parentHealth.allergiesPlaceholder')} />
              </div>
              <div className="form-group">
                <label>{t('parentHealth.bloodType')}</label>
                <select value={form.bloodType} onChange={(e) => setForm({ ...form, bloodType: e.target.value })}>
                  <option value="">—</option>
                  {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group grow">
                <label>{t('parentHealth.chronicConditions')}</label>
                <input value={form.chronicConditions} onChange={(e) => setForm({ ...form, chronicConditions: e.target.value })} placeholder={t('parentHealth.chronicPlaceholder')} />
              </div>
              <div className="form-group grow">
                <label>{t('parentHealth.emergencyPhone')}</label>
                <input dir="ltr" value={form.emergencyPhone} onChange={(e) => setForm({ ...form, emergencyPhone: e.target.value })} placeholder="+216 ..." />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group grow">
                <label>{t('parentHealth.notes')}</label>
                <textarea rows="2" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
            <button className="btn btn-primary" type="submit">
              <span className="material-icons">save</span> {t('parentHealth.save')}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
