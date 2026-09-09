import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';

export default function ChildCredentials() {
  const { t } = useI18n();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [flipped, setFlipped] = useState({});
  const [copied, setCopied] = useState('');

  const load = useCallback(() => {
    api.get('/parent/children/credentials')
      .then((d) => setList(Array.isArray(d) ? d : []))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = (id) => setFlipped((f) => ({ ...f, [id]: !f[id] }));

  const copy = async (text, key) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(''), 1500); } catch { /* ignore */ }
  };

  if (loading) return <div className="loading-wrap"><span className="spinner" /></div>;

  if (!list.length) {
    return (
      <div className="panel">
        <h3>{t('parentSpace.credentials.title')}</h3>
        <p className="muted">{t('parentSpace.credentials.empty')}</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{t('parentSpace.credentials.title')}</h3>
        <p className="muted" style={{ fontSize: '0.85rem' }}>{t('parentSpace.credentials.hint')}</p>
      </div>
      <div className="cred-grid">
        {list.map((c) => (
          <div key={c.id} className={`cred-card ${flipped[c.id] ? 'flipped' : ''}`} onClick={() => toggle(c.id)}>
            <div className="cred-inner">
              <div className="cred-face cred-front">
                <span className="cred-ribbon" />
                <span className="material-icons cred-icon">child_care</span>
                <div className="cred-name">{c.name}</div>
                <div className="cred-level">{c.level}</div>
                <div className="cred-tap">{flipped[c.id] ? '⇲' : 'اضغط لعرض البيانات'}</div>
              </div>
              <div className="cred-face cred-back">
                <span className="cred-ribbon" />
                <div className="cred-field">
                  <label>البريد</label>
                  <div className="cred-val" dir="ltr">
                    <span>{c.email}</span>
                    <button type="button" className="cred-copy" onClick={(e) => { e.stopPropagation(); copy(c.email, c.id + 'e'); }}>{copied === c.id + 'e' ? '✓' : '⧉'}</button>
                  </div>
                </div>
                <div className="cred-field">
                  <label>كلمة السر</label>
                  <div className="cred-val" dir="ltr">
                    <span className="cred-pw">{c.password}</span>
                    <button type="button" className="cred-copy" onClick={(e) => { e.stopPropagation(); copy(c.password, c.id + 'p'); }}>{copied === c.id + 'p' ? '✓' : '⧉'}</button>
                  </div>
                </div>
                <div className="cred-note">غيّرها بعد أول دخول</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
