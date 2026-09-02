import { useI18n } from '../../i18n/index.jsx';

export default function ChildProgress({ childrenData }) {
  const { lang, t } = useI18n();
  if (childrenData.length === 0) {
    return (
      <div className="panel">
        <div className="empty">{t('childProgress.empty')}</div>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{t('childProgress.title')}</h3>
      </div>
      <div className="cards-grid">
        {childrenData.map(({ student, progress }) => (
          <div key={student.id} className="card-item child-card">
            <h4>{student.firstName} {student.lastName}</h4>
            <p className="sub">{progress ? `${student.level} — ${student.class?.name || ''}` : t('childProgress.noAccount')}</p>

            {!progress ? (
              <div className="form-error">{student.error || t('childProgress.noData')}</div>
            ) : (
              <>
                <div className="profile-xp">
                  <span className="xp-badge">⭐ {progress.level}</span>
                  <span className="xp-badge">⚡ {progress.xp} XP</span>
                  <span className="xp-badge">🪙 {progress.coins}</span>
                  <span className="xp-badge">🔥 {progress.streakDays}</span>
                </div>

                <div className="mini-stats">
                  <div className="mini-stat">
                    <strong>{progress.quizzesDone}</strong>
                    <span>{t('childProgress.quiz')}</span>
                  </div>
                  <div className="mini-stat">
                    <strong>{progress.avgPercent}%</strong>
                    <span>{t('childProgress.average')}</span>
                  </div>
                  <div className="mini-stat">
                    <strong>{progress.badges.length}</strong>
                    <span>{t('childProgress.badge')}</span>
                  </div>
                </div>

                <h5>{t('childProgress.latestResults')}</h5>
                {progress.latestResults.length === 0 ? (
                  <p className="muted">{t('childProgress.noResults')}</p>
                ) : (
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>{t('childProgress.quizColumn')}</th>
                          <th>{t('childProgress.resultColumn')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {progress.latestResults.map((r) => (
                          <tr key={r.id}>
                            <td>{r.title}</td>
                            <td>
                              <span className={`badge ${r.percent >= 70 ? 'good' : r.percent >= 45 ? 'warn' : 'bad'}`}>
                                {r.percent}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <h5>{t('childProgress.attendanceTitle')}</h5>
                {progress.attendance?.last30Days ? (
                  <>
                    <div className="profile-xp">
                      <span className="badge good">{t('childProgress.presentCount', { n: progress.attendance.last30Days - progress.attendance.absent })}</span>
                      <span className="badge warn">{t('childProgress.absentCount', { n: progress.attendance.absent })}</span>
                    </div>
                    {progress.attendance.records.length > 0 && (
                      <div className="table-wrap">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>{t('childProgress.dateColumn')}</th>
                              <th>{t('childProgress.statusColumn')}</th>
                              <th>{t('childProgress.noteColumn')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {progress.attendance.records.map((a, i) => (
                              <tr key={i}>
                                <td>{new Date(a.date).toLocaleDateString(lang === 'ar' ? 'ar-TN' : 'en-GB')}</td>
                                <td>
                                  <span className={`badge ${a.present ? 'good' : 'bad'}`}>
                                    {a.present ? t('childProgress.present') : t('childProgress.absent')}
                                  </span>
                                </td>
                                <td className="muted">{a.note || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="muted">{t('childProgress.noAttendance')}</p>
                )}

                {progress.teacher && (
                  <p className="muted" style={{ marginTop: 12 }}>
                    {t('childProgress.classTeacher', { name: `${progress.teacher.firstName} ${progress.teacher.lastName}` })}
                  </p>
                )}

                {progress.paperExams && progress.paperExams.length > 0 && (
                  <>
                    <h5 style={{ marginTop: 14 }}>{t('childProgress.scannedPapers')}</h5>
                    <div className="table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>{t('childProgress.quizColumn')}</th>
                            <th>{t('childProgress.statusColumn')}</th>
                            <th>{t('childProgress.resultColumn')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {progress.paperExams.map((p) => (
                            <tr key={p.id}>
                              <td>{p.examTitle}</td>
                              <td>
                                <span className={`badge ${p.status === 'CORRECTED' ? 'good' : 'warn'}`}>
                                  {p.status === 'CORRECTED' ? t('childProgress.corrected') : p.status === 'IN_REVIEW' ? t('childProgress.inReview') : t('childProgress.submitted')}
                                </span>
                              </td>
                              <td>{p.score !== null && p.score !== undefined ? `${p.score} / 20` : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
