import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';

export default function Suggestions() {
  const { t } = useI18n();
  const [suggestions, setSuggestions] = useState([]);

  const load = useCallback(() => {
    api
      .get('/teacher/suggestions')
      .then(setSuggestions)
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const generate = async () => {
    const data = await api.post('/teacher/suggestions/generate');
    setSuggestions((s) => [...data, ...s]);
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{t('teacherSpace.suggestions.title')}</h3>
        <button className="btn btn-primary" onClick={generate}>{t('teacherSpace.suggestions.generateBtn')}</button>
      </div>

      {suggestions.length === 0 ? (
        <div className="empty">{t('teacherSpace.suggestions.empty')}</div>
      ) : (
        <div className="cards-grid">
          {suggestions.map((s) => (
            <div key={s.id} className="card-item">
              <span className="badge">{s.category}</span>
              <h4>{s.title}</h4>
              <p className="muted">{s.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
