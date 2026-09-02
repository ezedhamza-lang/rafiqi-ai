import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useI18n } from '../i18n/index.jsx';

export default function AdminAiKey() {
  const { t } = useI18n();
  const [configured, setConfigured] = useState(null);
  const [source, setSource] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const refresh = () => {
    api
      .get('/admin/ai/key')
      .then((d) => {
        setConfigured(d.configured);
        setSource(d.source);
      })
      .catch((err) => setMsg(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      await api.post('/admin/ai/key', { apiKey: apiKey.trim() });
      setApiKey('');
      setMsg(t('adminAiKey.saved'));
      refresh();
    } catch (err) {
      setMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setMsg('');
    try {
      await api.del('/admin/ai/key');
      setMsg(t('adminAiKey.removed'));
      refresh();
    } catch (err) {
      setMsg(err.message);
    }
  };

  const sourceLabel = configured
    ? source === 'db'
      ? t('adminAiKey.sourceDb')
      : t('adminAiKey.sourceEnv')
    : t('adminAiKey.notConfigured');

  return (
    <div>
      <h3 style={{ color: 'var(--primary)', marginBottom: '0.8rem' }}>{t('adminAiKey.title')}</h3>
      {msg && <div className="form-success">{msg}</div>}

      {loading ? (
        <div className="loading-wrap">
          <span className="spinner" />
        </div>
      ) : (
        <div className="card" style={{ maxWidth: '520px', padding: '1.2rem' }}>
          <p style={{ color: 'var(--muted)', marginBottom: '0.8rem' }}>
            {t('adminAiKey.description')}
          </p>
          <p style={{ marginBottom: '1rem' }}>
            <strong>{t('adminAiKey.currentStatus')}</strong>{' '}
            <span className={`badge ${configured ? 'badge-validated' : 'badge-rejected'}`}>
              {sourceLabel}
            </span>
          </p>

          <form onSubmit={save}>
            <label htmlFor="platform-ai-key">{t('adminAiKey.newGeminiKey')}</label>
            <input
              id="platform-ai-key"
              type="password"
              autoComplete="new-password"
              placeholder={t('adminAiKey.geminiPlaceholder')}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              style={{ width: '100%', marginBottom: '0.8rem' }}
            />
            <button type="submit" className="btn btn-primary" disabled={saving || !apiKey.trim()}>
              {saving ? t('adminAiKey.saving') : t('adminAiKey.saveKey')}
            </button>
          </form>

          {configured && (
            <button
              type="button"
              className="btn btn-danger"
              onClick={remove}
              style={{ marginTop: '0.8rem' }}
            >
              {t('adminAiKey.deleteKey')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
