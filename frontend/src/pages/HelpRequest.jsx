import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useI18n } from '../i18n/index.jsx';

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  requestType: '',
  delegation: '',
  description: '',
  attachment: null
};

export default function HelpRequest() {
  const { t } = useI18n();
  const [types, setTypes] = useState([]);
  const [delegations, setDelegations] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/help-requests/types'), api.get('/public/delegations')])
      .then(([t, d]) => {
        setTypes(t);
        setDelegations(d);
      })
      .catch(console.error);
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        if (value) fd.append(key, value);
      });
      const res = await fetch('/api/help-requests', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('school_token') || ''}` },
        body: fd
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t('helpRequest.errorGeneric'));
      setSuccess(t('helpRequest.successSent'));
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const onFile = (file) => {
    if (file) setForm({ ...form, attachment: file });
  };

  return (
    <>
      <h2>{t('helpRequest.title')}</h2>
      <p style={{ color: 'var(--muted)', marginBottom: '1.4rem', lineHeight: 1.8 }}>
        {t('helpRequest.subtitle')}
      </p>

      {error && <div className="form-error">{error}</div>}
      {success && <div className="form-success">{success}</div>}

      <form onSubmit={submit}>
        <h3 style={{ color: 'var(--primary)', fontSize: '1.05rem', marginBottom: '1rem' }}>{t('helpRequest.personalData')}</h3>
        <div className="form-row">
          <div className="form-group">
            <label>{t('helpRequest.firstName')}</label>
            <input required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
          </div>
          <div className="form-group">
            <label>{t('helpRequest.lastName')}</label>
            <input required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>{t('helpRequest.phone')}</label>
            <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="form-group">
            <label>{t('helpRequest.email')}</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
        </div>

        <h3 style={{ color: 'var(--primary)', fontSize: '1.05rem', margin: '1.4rem 0 1rem' }}>{t('helpRequest.requestInfo')}</h3>
        <div className="form-row">
          <div className="form-group">
            <label>{t('helpRequest.requestType')}</label>
            <select required value={form.requestType} onChange={(e) => setForm({ ...form, requestType: e.target.value })}>
              <option value="">{t('helpRequest.choose')}</option>
              {types.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>{t('helpRequest.delegation')}</label>
            <select value={form.delegation} onChange={(e) => setForm({ ...form, delegation: e.target.value })}>
              <option value="">{t('helpRequest.choose')}</option>
              {delegations.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-group">
          <label>{t('helpRequest.description')}</label>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={t('helpRequest.descriptionPlaceholder')} />
        </div>

        <div className="form-group">
          <label>{t('helpRequest.uploadDocs')}</label>
          <div
            className={`dropzone ${dragging ? 'dragging' : ''}`}
            onClick={() => document.getElementById('file-input').click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              onFile(e.dataTransfer.files[0]);
            }}
          >
            {form.attachment ? (
              <>
                <span className="material-icons">insert_drive_file</span>
                <p>{form.attachment.name}</p>
                <span className="hint">{t('helpRequest.changeFile')}</span>
              </>
            ) : (
              <>
                <span className="material-icons">cloud_upload</span>
                <p>{t('helpRequest.dragDrop')}</p>
                <span className="hint">{t('helpRequest.acceptedFormats')}</span>
              </>
            )}
          </div>
          <input
            id="file-input"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            style={{ display: 'none' }}
            onChange={(e) => onFile(e.target.files[0])}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? t('helpRequest.sending') : t('helpRequest.submit')}
          </button>
          <button className="btn btn-ghost" type="button" onClick={() => setForm(EMPTY_FORM)}>
            {t('helpRequest.cancel')}
          </button>
        </div>
      </form>
    </>
  );
}
