// تقرير القسم (المرحلة D) — مصفوفة موحّدة: حضور + كل الأعمال + إتقان الكفايات.
// قاعدة العرض: «بانتظار التصحيح» لا يُعرض كـ0، والقيم الفارغة تُترك فارغة.
import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';
import { levelLabel, kindLabel, subjectLabel, statusLabel } from '../../utils/labels.js';

const MASTERY_KEYS = ['max', 'min', 'below', 'none'];

function fmtDate(value, lang) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString(lang === 'ar' ? 'ar-TN' : 'en-GB');
  } catch {
    return '—';
  }
}

function cellText(cell, t) {
  if (!cell || cell.state === 'missing') return t('classReport.state.missing');
  if (cell.state === 'pending') return t('classReport.state.pending');
  if (cell.state === 'submitted') return t('classReport.state.submitted');
  if (cell.percent == null) return t('classReport.state.gradedNoScore');
  return `${cell.percent}%`;
}

function cellClass(cell) {
  if (!cell || cell.state === 'missing') return 'rpt-cell rpt-cell--missing';
  if (cell.state === 'pending') return 'rpt-cell rpt-cell--pending';
  if (cell.state === 'submitted') return 'rpt-cell rpt-cell--submitted';
  if (cell.percent == null) return 'rpt-cell rpt-cell--submitted';
  if (cell.percent >= 70) return 'rpt-cell rpt-cell--good';
  if (cell.percent >= 45) return 'rpt-cell rpt-cell--warn';
  return 'rpt-cell rpt-cell--bad';
}

export default function ClassReport() {
  const { t, lang } = useI18n();
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [report, setReport] = useState(null);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api
      .get('/teacher/classes')
      .then((list) => {
        setClasses(list);
        setClassId((prev) => prev || (list[0] ? String(list[0].id) : ''));
      })
      .catch((e) => setMsg(e.message));
  }, []);

  const load = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    setMsg('');
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const qs = params.toString();
      setReport(await api.get(`/teacher/classes/${classId}/report${qs ? `?${qs}` : ''}`));
    } catch (e) {
      setMsg(e.message);
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [classId, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const csv = useMemo(() => {
    if (!report) return '';
    const header = [
      t('classReport.csv.student'),
      t('classReport.csv.attendance'),
      ...report.items.map((i) => `${i.title} (${kindLabel(i.kind, lang)})`)
    ];
    const lines = [header.join(';')];
    for (const row of report.rows) {
      lines.push(
        [
          `${row.firstName} ${row.lastName}`,
          row.attendance.rate == null ? '—' : `${row.attendance.rate}%`,
          ...report.items.map((i) => cellText(row.cells[i.id], t))
        ]
          .map((v) => (/[",\n;]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v))
          .join(';')
      );
    }
    return lines.join('\n');
  }, [report, t, lang]);

  const downloadCsv = () => {
    if (!csv) return;
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapport-${(report.class.name || 'classe').replace(/\s+/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="panel">
      <div className="panel-head rpt-head">
        <div>
          <h3>{t('classReport.title')}</h3>
          <p className="muted">{t('classReport.subtitle')}</p>
        </div>
        <div className="rpt-head__actions">
          <button className="btn btn-ghost" disabled={!report} onClick={() => window.print()}>
            <span className="material-icons">print</span> {t('classReport.print')}
          </button>
          <button className="btn btn-ghost" disabled={!report} onClick={downloadCsv}>
            <span className="material-icons">download</span> {t('classReport.csvBtn')}
          </button>
        </div>
      </div>

      <div className="creds-toolbar">
        <label className="creds-field">
          <span>{t('classReport.classLabel')}</span>
          <select
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value);
              setReport(null);
            }}
          >
            {classes.length === 0 && <option value="">{t('classReport.noClasses')}</option>}
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({levelLabel(c.level, lang)})
              </option>
            ))}
          </select>
        </label>
        <label className="creds-field">
          <span>{t('classReport.fromLabel')}</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="creds-field">
          <span>{t('classReport.toLabel')}</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>

      {msg && <div className="form-error" style={{ marginBottom: '0.8rem' }}>{msg}</div>}

      {loading ? (
        <div className="loading-wrap"><span className="spinner" /></div>
      ) : !report ? null : (
        <>
          <div className="rpt-summary">
            <div className="rpt-stat">
              <span>{t('classReport.statStudents')}</span>
              <strong>{report.totals.students}</strong>
            </div>
            <div className="rpt-stat">
              <span>{t('classReport.statItems')}</span>
              <strong>{report.totals.items}</strong>
            </div>
            <div className="rpt-stat">
              <span>{t('classReport.statAttendanceDays')}</span>
              <strong>{report.attendanceDays}</strong>
            </div>
            <div className={`rpt-stat ${report.totals.pendingManual > 0 ? 'rpt-stat--warn' : ''}`}>
              <span>{t('classReport.statPending')}</span>
              <strong>{report.totals.pendingManual}</strong>
            </div>
          </div>

          {report.totals.pendingManual > 0 && (
            <p className="rpt-honesty">
              <span className="material-icons">info</span>
              {t('classReport.honestyNote', { n: report.totals.pendingManual })}
            </p>
          )}

          {report.items.length === 0 ? (
            <div className="empty">{t('classReport.noItems')}</div>
          ) : (
            <div className="table-wrap">
              <table className="data-table rpt-matrix">
                <thead>
                  <tr>
                    <th>{t('classReport.colStudent')}</th>
                    <th>{t('classReport.colAttendance')}</th>
                    {report.items.map((i) => (
                      <th key={i.id}>
                        <span className="rpt-item-kind">{kindLabel(i.kind, lang)}</span>
                        <span className="rpt-item-title">{i.title}</span>
                        <span className="rpt-item-sub">
                          {subjectLabel(i.subject, lang)} · {i.date ? fmtDate(i.date, lang) : t('classReport.noDate')}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((row) => (
                    <tr key={row.studentId}>
                      <td>
                        {row.firstName} {row.lastName}
                      </td>
                      <td>
                        {row.attendance.rate == null ? (
                          <span className="muted">—</span>
                        ) : (
                          <span className={`badge badge-${row.attendance.rate >= 80 ? 'approved' : row.attendance.rate >= 50 ? 'pending' : 'rejected'}`}>
                            {row.attendance.rate}%
                          </span>
                        )}
                        {row.attendance.absent > 0 && (
                          <span className="rpt-absent">
                            {t('classReport.absentCount', { n: row.attendance.absent })}
                          </span>
                        )}
                      </td>
                      {report.items.map((i) => {
                        const cell = row.cells[i.id];
                        return (
                          <td key={i.id} className={cellClass(cell)} title={cell?.status ? statusLabel(cell.status, lang) : ''}>
                            {cellText(cell, t)}
                            {cell?.state === 'pending' && cell.reason && (
                              <span className="rpt-reason">{t(`classReport.reason.${cell.reason}`)}</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {report.criteria.length > 0 && (
            <div className="rpt-criteria">
              <h4>{t('classReport.criteriaTitle')}</h4>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t('classReport.colCriterion')}</th>
                      <th>{t('classReport.colMastery')}</th>
                      <th>{t('classReport.colMasteryIndex')}</th>
                      <th>{t('classReport.colEarned')}</th>
                      <th>{t('classReport.colDistribution')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.criteria.map((c) => (
                      <tr key={c.key}>
                        <td>
                          {c.label || c.criterion}
                          <span className="rpt-item-sub">
                            {c.itemId.startsWith('exam-')
                              ? report.items.find((i) => i.id === c.itemId)?.title
                              : null}
                          </span>
                        </td>
                        <td>
                          {c.mastery ? (
                            <span className="rpt-mastery-scale">
                              {MASTERY_KEYS.map((k) => (
                                <span key={k}>
                                  {t(`classReport.mastery.${k}`)}: {c.mastery[k] ?? '—'}
                                </span>
                              ))}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          {c.masteryIndex == null ? (
                            <span className="muted">—</span>
                          ) : (
                            <strong>{c.masteryIndex}/4</strong>
                          )}
                        </td>
                        <td>
                          {c.earnedAvg == null ? (
                            <span className="muted">—</span>
                          ) : (
                            `${c.earnedAvg} / ${c.max ?? '—'}`
                          )}
                        </td>
                        <td>
                          {Object.keys(c.distribution).length === 0 ? (
                            <span className="muted">—</span>
                          ) : (
                            <span className="rpt-dist">
                              {MASTERY_KEYS.filter((k) => c.distribution[k]).map((k) => (
                                <span key={k} className={`badge rpt-dist__${k}`}>
                                  {t(`classReport.mastery.${k}`)}: {c.distribution[k]}
                                </span>
                              ))}
                              {c.pendingManual > 0 && (
                                <span className="badge badge-pending">{t('classReport.pendingCount', { n: c.pendingManual })}</span>
                              )}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
