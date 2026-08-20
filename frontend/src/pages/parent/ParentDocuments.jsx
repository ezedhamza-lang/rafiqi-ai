import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';
import { DOC_STATUS_LABEL_KEYS, docStatusBadgeClass } from '../../roles.js';

export default function ParentDocuments() {
  const { lang, t } = useI18n();
  const [docs, setDocs] = useState([]);
  const [children, setChildren] = useState([]);
  const [types, setTypes] = useState([]);
  const [form, setForm] = useState({ studentId: '', docType: '', title: '', note: '' });
  const [file, setFile] = useState(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api
      .get('/parent/documents')
      .then(setDocs)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    Promise.all([api.get('/students'), api.get('/parent/documents/types'), api.get('/parent/documents')])
      .then(([students, typesList, docsList]) => {
        setChildren(students);
        setTypes(typesList);
        setDocs(docsList);
      })
      .catch((e) => setError(e.message));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setMsg('');
    if (!form.docType) return setError(t('parentDocs.errChooseType'));
    if (!file) return setError(t('parentDocs.errAttachFile'));
    try {
      const fd = new FormData();
      fd.append('studentId', form.studentId);
      fd.append('docType', form.docType);
      fd.append('title', form.title);
      fd.append('note', form.note);
      fd.append('file', file);
      const res = await api.post('/parent/documents', fd);
      setMsg(t('parentDocs.sentMsg', { docType: res.docType }));
      setForm({ studentId: '', docType: '', title: '', note: '' });
      setFile(null);
      e.target.reset();
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{t('parentDocs.title')}</h3>
        <p className="muted">{t('parentDocs.subtitle')}</p>
      </div>

      {error && <div className="form-error" style={{ marginBottom: '0.8rem' }}>{error}</div>}
      {msg && <div className="form-success" style={{ marginBottom: '0.8rem' }}>{msg}</div>}

      <form className="card-form" onSubmit={submit}>
        <div className="form-row">
          <div className="form-group">
            <label>{t('parentDocs.childOptional')}</label>
            <select value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })}>
              <option value="">{t('parentDocs.unspecified')}</option>
              {children.map((c) => (
                <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
              ))}
            </select>
          </div>
          <div className="form-group grow">
            <label>{t('parentDocs.docType')} *</label>
            <select required value={form.docType} onChange={(e) => setForm({ ...form, docType: e.target.value })}>
              <option value="">{t('parentDocs.chooseType')}</option>
              {types.map((ty) => (
                <option key={ty} value={ty}>{ty}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group grow">
            <label>{t('parentDocs.titleOptional')}</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder={t('parentDocs.titlePlaceholder')}
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group grow">
            <label>{t('parentDocs.noteOptional')}</label>
            <textarea
              rows="2"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder={t('parentDocs.notePlaceholder')}
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group grow">
            <label>{t('parentDocs.fileLabel')}</label>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={(e) => setFile(e.target.files[0])} />
          </div>
          <button className="btn btn-primary" type="submit">
            <span className="material-icons">upload_file</span> {t('parentDocs.submit')}
          </button>
        </div>
      </form>

      <h4 style={{ marginTop: '1.4rem', marginBottom: '0.7rem' }}>{t('parentDocs.archiveTitle', { n: docs.length })}</h4>
      {docs.length === 0 ? (
        <div className="empty">{t('parentDocs.noDocs')}</div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('parentDocs.dateColumn')}</th>
                <th>{t('parentDocs.studentColumn')}</th>
                <th>{t('parentDocs.typeColumn')}</th>
                <th>{t('parentDocs.titleColumn')}</th>
                <th>{t('parentDocs.fileColumn')}</th>
                <th>{t('parentDocs.statusColumn')}</th>
                <th>{t('parentDocs.replyColumn')}</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id}>
                  <td>{new Date(d.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-TN' : 'en-GB')}</td>
                  <td>{d.student ? `${d.student.firstName} ${d.student.lastName}` : '—'}</td>
                  <td>{d.docType}</td>
                  <td>{d.title || '—'}</td>
                  <td>
                    <a href={d.fileUrl} target="_blank" rel="noreferrer" className="btn btn-sm">
                      <span className="material-icons">visibility</span> {t('parentDocs.view')}
                    </a>
                  </td>
                  <td>
                    <span className={`badge badge-${docStatusBadgeClass(d.status)}`}>
                      {DOC_STATUS_LABEL_KEYS[d.status] ? t(DOC_STATUS_LABEL_KEYS[d.status]) : d.status}
                    </span>
                  </td>
                  <td className="muted">{d.directorReply || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
