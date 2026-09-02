import { useState, useEffect } from 'react';
import { useI18n } from '../../i18n/index.jsx';
import { api } from '../../api/client.js';

export default function TeacherGradebook() {
  const { t } = useI18n();
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState('');
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/teacher/classes').then(setClasses).catch(() => {});
  }, []);

  const load = (id) => {
    if (!id) return;
    setClassId(id);
    setLoading(true);
    api
      .get(`/teacher/gradebook?classId=${id}`)
      .then(setBook)
      .catch(() => setBook(null))
      .finally(() => setLoading(false));
  };

  const exportCsv = () => {
    if (!book) return;
    const head = ['التلميذ', ...book.items.map((i) => i.title), 'المعدل'];
    const lines = book.rows.map((r) => [
      r.name,
      ...book.items.map((_, idx) => (r.grades[idx] !== undefined ? r.grades[idx] : '')),
      r.average ?? ''
    ]);
    const csv = '\uFEFF' + [head, ...lines].map((row) => row.map((c) => `"${c}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `gradebook-${classId}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="gradebook-page">
      <div className="space-head">
        <div>
          <h2>{t('teacherSpace.gradebook.title')}</h2>
          <p className="sub">{t('teacherSpace.gradebook.subtitle')}</p>
        </div>
        <select value={classId} onChange={(e) => load(e.target.value)}>
          <option value="">{t('teacherSpace.gradebook.selectClass')}</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {loading && <p className="muted">{t('common.loading')}</p>}

      {!loading && book && (
        <>
          <div className="card">
            <div className="table-wrap">
              <table className="gradebook-table">
                <thead>
                  <tr>
                    <th>{t('teacherSpace.gradebook.student')}</th>
                    {book.items.map((i) => (
                      <th key={i.id} title={i.type === 'assignment' ? t('teacherSpace.gradebook.assignment') : t('teacherSpace.gradebook.quiz')}>
                        {i.title.length > 16 ? `${i.title.slice(0, 16)}…` : i.title}
                      </th>
                    ))}
                    <th>{t('teacherSpace.gradebook.average')}</th>
                  </tr>
                </thead>
                <tbody>
                  {book.rows.map((r) => (
                    <tr key={r.studentId}>
                      <td>{r.name}</td>
                      {book.items.map((_, idx) => (
                        <td key={idx}>{r.grades[idx] !== undefined ? r.grades[idx] : '—'}</td>
                      ))}
                      <td><strong>{r.average !== null ? `${r.average}%` : '—'}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <button className="btn btn-primary" onClick={exportCsv}>
            <span className="material-icons">file_download</span>
            {t('teacherSpace.gradebook.exportCsv')}
          </button>
        </>
      )}

      {!loading && !book && classId && <p className="muted">{t('common.noData')}</p>}
    </div>
  );
}