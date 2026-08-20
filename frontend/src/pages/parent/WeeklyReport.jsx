import { useI18n } from '../../i18n/index.jsx';

export default function WeeklyReport({ childrenData }) {
  const { lang, t } = useI18n();
  const now = new Date();
  const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  const periodLabel = now.toLocaleDateString(lang === 'ar' ? 'ar-TN' : 'en-GB', options);

  const childrenWithProgress = childrenData.filter((c) => c.progress);

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{t('weeklyReport.title')}</h3>
        <span className="badge">{periodLabel}</span>
      </div>

      {childrenWithProgress.length === 0 ? (
        <div className="empty">{t('weeklyReport.empty')}</div>
      ) : (
        <div className="cards-grid">
          {childrenWithProgress.map(({ student, progress }) => {
            const diff = progress.weeklyAccuracy - progress.lastWeekAccuracy;
            return (
              <div key={student.id} className="card-item">
                <h4>{t('weeklyReport.reportTitle', { name: `${student.firstName} ${student.lastName}` })}</h4>

                <div className="report-comparison">
                  <div className="compare-item">
                    <span className="muted">{t('weeklyReport.accuracyThisWeek')}</span>
                    <strong className={progress.weeklyAccuracy >= 70 ? 'good-text' : 'warn-text'}>{progress.weeklyAccuracy}%</strong>
                  </div>
                  <div className="compare-item">
                    <span className="muted">{t('weeklyReport.lastWeek')}</span>
                    <strong>{progress.lastWeekAccuracy}%</strong>
                  </div>
                  <div className={`compare-diff ${diff >= 0 ? 'good-text' : 'bad-text'}`}>
                    {diff >= 0 ? '▲' : '▼'} {Math.abs(diff)}%
                  </div>
                </div>

                <div className="mini-stats">
                  <div className="mini-stat">
                    <strong>{progress.quizzesDone}</strong>
                    <span>{t('weeklyReport.quizzesThisWeek')}</span>
                  </div>
                  <div className="mini-stat">
                    <strong>{progress.xp}</strong>
                    <span>{t('weeklyReport.totalXp')}</span>
                  </div>
                  <div className="mini-stat">
                    <strong>{progress.streakDays}</strong>
                    <span>{t('weeklyReport.streakDay')}</span>
                  </div>
                </div>

                <div className="report-note">
                  <p>
                    <strong>{t('weeklyReport.noteLabel')}</strong>{' '}
                    {progress.weeklyAccuracy >= 70
                      ? t('weeklyReport.noteGood')
                      : progress.weeklyAccuracy >= 45
                        ? t('weeklyReport.noteOk')
                        : t('weeklyReport.noteBad')}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
