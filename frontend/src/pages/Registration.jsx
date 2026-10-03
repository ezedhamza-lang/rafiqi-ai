import { useEffect, useState, useRef } from 'react';
import { api } from '../api/client.js';
import { REQUEST_STATUS_LABEL_KEYS, statusBadgeClass } from '../roles.js';
import { useI18n } from '../i18n/index.jsx';
import { levelLabel } from '../utils/labels.js';

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  birthDate: '',
  cin: '',
  gender: '',
  level: '',
  schoolYear: '2026-2027',
  schoolName: '',
  notes: ''
};

export default function Registration() {
  const { lang, t } = useI18n();
  const [levels, setLevels] = useState([]);
  const [requests, setRequests] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [user] = useState(() => {
    try { return JSON.parse(localStorage.getItem('school_user')); } catch { return null; }
  });
  // حساب دورين: معلّم وهو وليّ أمر يستطيع تقديم طلبات تسجيل أبنائه
  const canSubmit = user && ['PARENT', 'TEACHER'].includes(user.role);
  const [step, setStep] = useState(1);
  const formRef = useRef(null);
  const goNext = () => {
    const f = formRef.current;
    if (f && typeof f.reportValidity === 'function' && !f.reportValidity()) return;
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    Promise.all([api.get('/public/levels'), canSubmit ? api.get('/subscription-requests/mine') : Promise.resolve([])])
      .then(([l, r]) => {
        setLevels(l);
        setRequests(r);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [canSubmit]);

  const submit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    setSuccess('');
    setSubmitting(true);
    try {
      await api.post('/subscription-requests', form);
      const fresh = canSubmit ? await api.get('/subscription-requests/mine') : [];
      setRequests(fresh);
      setSuccess(t('registration.success'));
      setForm(EMPTY_FORM);
      setStep(1);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const cancel = async (id) => {
    if (!window.confirm(t('registration.cancelConfirm'))) return;
    try {
      await api.put(`/subscription-requests/${id}/cancel`, {});
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'CANCELLED' } : r)));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="container reg-wizard" style={{ maxWidth: 960, paddingTop: '.75rem', paddingBottom: '2rem' }}>
      {error && <div className="form-error">{error}</div>}
      {success && <div className="form-success">{success}</div>}

      {canSubmit && (
        <>
          <h2>{t('registration.title')}</h2>
          <p className="reg-tagline">{t('registration.welcomeTag')}</p>
          <p className="reg-desc">{t('registration.welcomeDesc')}</p>
          <ol className="reg-steps2">
            <li className={step === 1 ? 'on' : ''}><span className="n">1</span> {t('registration.step1Short')}</li>
            <li className="reg-steps2__sep" aria-hidden="true" />
            <li className={step === 2 ? 'on' : ''}><span className="n">2</span> {t('registration.step2Title')}</li>
          </ol>
          <form ref={formRef} onSubmit={submit} style={{ marginBottom: '2rem' }}>
            {step === 1 && (
              <div className="reg-card">
                <h3 className="reg-card__title"><span className="material-icons">child_care</span> {t('registration.step1Title')}</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>{t('registration.studentFirstName')}</label>
                    <input required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>{t('registration.studentLastName')}</label>
                    <input required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>{t('registration.birthDate')}</label>
                    <input type="date" required value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>{t('registration.gender')}</label>
                    <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                      <option value="">{t('registration.choose')}</option>
                      <option value="ذكر">{t('registration.male')}</option>
                      <option value="أنثى">{t('registration.female')}</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>{t('registration.requestedLevel')}</label>
                    <select required value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
                      <option value="">{t('registration.choose')}</option>
                      {levels.map((l) => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>{t('registration.idCard')}</label>
                    <input value={form.cin} onChange={(e) => setForm({ ...form, cin: e.target.value })} />
                  </div>
                </div>
                <button className="btn btn-primary" type="button" onClick={goNext} style={{ width: '100%' }}>
                  {t('registration.continueBtn')}
                </button>
              </div>
            )}
            {step === 2 && (
              <div className="reg-card">
                <h3 className="reg-card__title"><span className="material-icons">school</span> {t('registration.step2Title')}</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>{t('registration.schoolYear')}</label>
                    <select value={form.schoolYear} onChange={(e) => setForm({ ...form, schoolYear: e.target.value })}>
                      <option>2026-2027</option>
                      <option>2025-2026</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>{t('registration.currentSchool')}</label>
                    <input value={form.schoolName} onChange={(e) => setForm({ ...form, schoolName: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label>{t('registration.notes')}</label>
                  <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder={t('registration.notesPlaceholder')} />
                </div>
                <div className="reg-note">
                  <span className="material-icons">lock</span>
                  <span>{t('registration.reviewNote')}</span>
                </div>
                <div className="reg-actions">
                  <button className="btn btn-outline" type="button" onClick={() => setStep(1)}>
                    {t('registration.backBtn')}
                  </button>
                  <button className="btn btn-primary" type="submit" disabled={submitting}>
                    {submitting ? <span className="spinner" style={{ fontSize: 18 }} /> : <span className="material-icons">send</span>} {submitting ? t('registration.submitting', '...جارٍ الإرسال') : <>{t('registration.submit')} ✓</>}
                  </button>
                </div>
              </div>
            )}
          </form>
        </>
      )}

      {!canSubmit && (
        <>
          <h2>{t('registration.title')}</h2>
          <div className="empty-state">
            <span className="material-icons">info</span>
            <p>{t('registration.parentsOnly')}</p>
          </div>
        </>
      )}

      {canSubmit && (
        <>
          <h3 style={{ color: 'var(--primary)', marginBottom: '0.8rem' }}>{t('registration.myRequests')}</h3>
          {loading ? (
            <div className="loading-wrap">
              <span className="spinner" />
            </div>
          ) : requests.length === 0 ? (
            <div className="empty-state">
              <span className="material-icons">how_to_reg</span>
              <p>{t('registration.empty')}</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t('registration.student')}</th>
                    <th>{t('registration.level')}</th>
                    <th>{t('registration.year')}</th>
                    <th>{t('registration.status')}</th>
                    <th>{t('registration.reason')}</th>
                    <th>{t('registration.date')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.id}>
                      <td>{r.firstName} {r.lastName}</td>
                      <td>{levelLabel(r.level, lang)}</td>
                      <td>{r.schoolYear}</td>
                      <td>
                        <span className={`badge badge-${statusBadgeClass(r.status)}`}>
                          {REQUEST_STATUS_LABEL_KEYS[r.status] ? t(REQUEST_STATUS_LABEL_KEYS[r.status]) : r.status}
                        </span>
                      </td>
                      <td>{r.rejectionReason || (r.class ? t('registration.classLabel', { class: r.class.name }) : '-')}</td>
                      <td className="date-value">{new Date(r.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-TN' : 'en-GB')}</td>
                      <td>
                        {r.status === 'PENDING_APPROVAL' && (
                          <button className="btn btn-danger btn-sm" onClick={() => cancel(r.id)}>
                            {t('registration.cancel')}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
