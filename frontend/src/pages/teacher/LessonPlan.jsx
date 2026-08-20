import { useState } from 'react';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';

export default function LessonPlan() {
  const { t } = useI18n();
  const [plan, setPlan] = useState(null);
  const [form, setForm] = useState({ lessonTitle: 'الجمع', duration: 45 });
  const [error, setError] = useState('');

  const create = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await api.post('/teacher/resources', {
        kind: 'LESSON_PLAN',
        subject: 'MATH',
        level: 'السنة الأولى أساسي',
        lessonTitle: form.lessonTitle,
        input: { duration: Number(form.duration) }
      });
      setPlan(res);
    } catch (err) {
      setError(err.message);
    }
  };

  const rebuild = async () => {
    const res = await api.post(`/teacher/resources/${plan.id}/rebuild`);
    setPlan(res);
  };

  const content = plan?.content || {};

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{t('teacherSpace.lessonPlan.title')}</h3>
      </div>
      {error && <div className="form-error">{error}</div>}

      {!plan ? (
        <form className="card-form" onSubmit={create}>
          <div className="form-row">
            <div className="form-group grow">
              <label>{t('teacherSpace.lessonPlan.lessonTitleLabel')}</label>
              <input required value={form.lessonTitle} onChange={(e) => setForm({ ...form, lessonTitle: e.target.value })} />
            </div>
            <div className="form-group">
              <label>{t('teacherSpace.lessonPlan.durationLabel')}</label>
              <input type="number" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} />
            </div>
            <button className="btn btn-primary" type="submit">{t('teacherSpace.lessonPlan.generateBtn')}</button>
          </div>
        </form>
      ) : (
        <div className="memo-view">
          <div className="panel-head">
            <h4>{content.title}</h4>
            <div className="btn-group">
              <button className="btn" onClick={() => window.print()}>{t('teacherSpace.lessonPlan.print')}</button>
              <button className="btn" onClick={rebuild}>{t('teacherSpace.lessonPlan.rebuild')}</button>
              <button className="btn" onClick={() => setPlan(null)}>{t('teacherSpace.lessonPlan.newPlan')}</button>
            </div>
          </div>
          <div className="lesson-plan">
            {content.stages?.map((s, i) => (
              <div key={i} className="stage-item plan-stage">
                <div className="stage-head">
                  <strong>{i + 1}. {s.name}</strong>
                  <span className="badge">{s.time} {t('teacherSpace.lessonPlan.minutesSuffix')}</span>
                </div>
                <p><strong>{t('teacherSpace.lessonPlan.goalLabel')}</strong> {s.goal}</p>
                <p><strong>{t('teacherSpace.lessonPlan.activityLabel')}</strong> {s.activity}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
