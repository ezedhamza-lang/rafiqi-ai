import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';

const PERIODS = [
  { v: '1', k: 't1' },
  { v: '2', k: 't2' },
  { v: '3', k: 't3' },
  { v: 'annual', k: 'annual' }
];

export default function ClassGrades() {
  const { t } = useI18n();
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState('');
  const [period, setPeriod] = useState('1');
  const [table, setTable] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/teacher/grades/classes').then(setClasses).catch(() => {});
  }, []);

  const load = useCallback(() => {
    if (!classId) { setTable(null); return; }
    setLoading(true);
    setError('');
    api.get(`/teacher/grades/classes/${classId}?period=${period}`)
      .then(setTable)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [classId, period]);

  useEffect(() => { load(); }, [load]);

  const cellMark = (row, code) => {
    const m = row.marks[code];
    return m === null || m === undefined ? '—' : m.toFixed(2);
  };

  const fmt = (v) => (v === null || v === undefined ? '—' : Number(v).toFixed(2));

  const download = (path, name) => api.download(path, name).catch((e) => setError(e.message));

  if (!classes.length) return <div className="loading-wrap"><span className="spinner" /></div>;

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{t('teacherSpace.classGrades.title')}</h3>
        <div className="btn-group">
          <button className="btn" disabled={!table} onClick={() => download(`/teacher/grades/classes/${classId}/pdf?period=${period}`, `grades-${period}.pdf`)}>
            {t('teacherSpace.classGrades.downloadBook')}
          </button>
        </div>
      </div>
      <p className="sub">{t('teacherSpace.classGrades.intro')}</p>
      {error && <div className="form-error" role="alert">{error}</div>}

      <div className="form-row" style={{ marginBottom: '0.7rem' }}>
        <div className="form-group grow">
          <label>{t('teacherSpace.classGrades.selectClass')}</label>
          <select value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">{t('teacherSpace.classGrades.pickClass')}</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name} — {c.level}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="badges-row" style={{ marginBottom: '0.8rem' }}>
        {PERIODS.map((p) => (
          <button key={p.v} className={`chip-toggle ${period === p.v ? 'active' : ''}`} onClick={() => setPeriod(p.v)}>
            {t(`teacherSpace.classGrades.periods.${p.k}`)}
          </button>
        ))}
      </div>

      {loading && <div className="loading-wrap"><span className="spinner" /></div>}

      {table && !loading && (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('teacherSpace.classGrades.colStudent')}</th>
                  {table.subjects.map((s) => (
                    <th key={s.code}>{s.label}<br /><span className="muted">×{s.coefficient}</span></th>
                  ))}
                  <th>{t('teacherSpace.classGrades.colMean')}</th>
                  <th>{t('teacherSpace.classGrades.colRank')}</th>
                  <th>{t('teacherSpace.classGrades.colMention')}</th>
                  {period !== 'annual' && <th>{t('teacherSpace.classGrades.colAnnual')}</th>}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {table.rows.map((r) => (
                  <tr key={r.studentUserId}>
                    <td><b>{r.firstName} {r.lastName}</b></td>
                    {table.subjects.map((s) => (
                      <td key={s.code}>{cellMark(r, s.code)}</td>
                    ))}
                    <td><b>{fmt(r.mean)}</b></td>
                    <td>{r.rank ?? '—'} / {table.effectifs}</td>
                    <td>{r.mention || '—'}</td>
                    {period !== 'annual' && <td>{fmt(r.annual)}</td>}
                    <td>
                      <button className="btn btn-sm" onClick={() => download(`/teacher/grades/students/${r.studentUserId}/classes/${classId}/certificate/pdf?period=${period}`, `certificate-${r.lastName}.pdf`)}>
                        {t('teacherSpace.classGrades.certificate')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted" style={{ fontSize: '0.8rem' }}>{t('teacherSpace.classGrades.formula')}</p>
        </>
      )}
      {!classId && <div className="empty">{t('teacherSpace.classGrades.pickFirst')}</div>}
    </div>
  );
}
