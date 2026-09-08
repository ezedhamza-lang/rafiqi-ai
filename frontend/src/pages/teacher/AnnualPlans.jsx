import { useState, useEffect, useCallback } from 'react';
import DOMPurify from 'dompurify';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';

const SUBJECTS = [
  { code: 'MATH', label: 'الرياضيات' },
  { code: 'READING', label: 'القراءة' },
  { code: 'SCIENCE', label: 'الإيقاظ العلمي' }
];

const PLAN_TEMPLATES = {
  MATH: {
    title: 'مخطط سنوي — الرياضيات',
    units: [
      { period: 'سبتمبر — أكتوبر', theme: 'الأعداد والعمليات', lessons: ['الأعداد من 0 إلى 5', 'الأعداد من 6 إلى 9', 'الجمع'] },
      { period: 'نوفمبر — ديسمبر', theme: 'الهندسة والقياس', lessons: ['الأشكال الهندسية', 'الطول والكتلة'] },
      { period: 'جانفي — فيفري', theme: 'الأعداد حتى 100', lessons: ['العشرات والآحاد', 'المقارنة والترتيب'] }
    ]
  },
  READING: {
    title: 'مخطط سنوي — القراءة',
    units: [
      { period: 'سبتمبر — نوفمبر', theme: 'الأحرف والكلمات', lessons: ['الحروف الهجائية', 'أصوات الحروف', 'قراءة الكلمات'] },
      { period: 'ديسمبر — فيفري', theme: 'الجمل والنصوص', lessons: ['الجمل القصيرة', 'نصوص قصيرة'] },
      { period: 'مارس — جوان', theme: 'التعبير والفهم', lessons: ['فهم المقروء', 'تعبير كتابي بسيط'] }
    ]
  },
  SCIENCE: {
    title: 'مخطط سنوي — الإيقاظ العلمي',
    units: [
      { period: 'سبتمبر — نوفمبر', theme: 'الكائنات الحية', lessons: ['الحيوانات والنباتات', 'أجسامنا'] },
      { period: 'ديسمبر — فيفري', theme: 'المادة والطاقة', lessons: ['الماء', 'الضوء والحرارة'] },
      { period: 'مارس — جوان', theme: 'البيئة والفصول', lessons: ['البيئة المحيطة', 'الفصول الأربعة'] }
    ]
  }
};

export default function AnnualPlans() {
  const { t } = useI18n();
  const [plans, setPlans] = useState([]);
  const [officialPlans, setOfficialPlans] = useState([]);
  const [subject, setSubject] = useState('MATH');
  const [view, setView] = useState(null);
  const [officialView, setOfficialView] = useState(null);

  const load = useCallback(() => {
    api
      .get('/teacher/plans')
      .then(setPlans)
      .catch(() => {});
    api
      .get('/public/plans')
      .then(setOfficialPlans)
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    const tpl = PLAN_TEMPLATES[subject];
    const plan = await api.post('/teacher/plans', {
      subject,
      level: 'السنة الأولى أساسي',
      title: tpl.title,
      content: { units: tpl.units }
    });
    setView(plan);
    load();
  };

  const remove = async (id) => {
    await api.del(`/teacher/plans/${id}`);
    setView(null);
    load();
  };

  const content = view?.content || {};

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{t('teacherSpace.annualPlans.title')}</h3>
        <div className="btn-group">
          <select value={subject} onChange={(e) => setSubject(e.target.value)}>
            {SUBJECTS.map((s) => (
              <option key={s.code} value={s.code}>{s.label}</option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={create}>{t('teacherSpace.annualPlans.newPlan')}</button>
        </div>
      </div>

      {officialPlans.length > 0 && (
        <>
          <h4 style={{ marginBottom: '0.8rem' }}>{t('teacherSpace.annualPlans.officialTitle')}</h4>
          <div className="card-grid">
            {officialPlans.map((p) => (
              <div key={p.id} className="card">
                <div className="lesson-head" style={{ background: 'linear-gradient(135deg, #233863, #2f4a7d)' }}>
                  <span className="material-icons" style={{ fontSize: '2.4rem', color: '#fff' }}>calendar_view_month</span>
                  <span className="lesson-num">{t('teacherSpace.annualPlans.imagesCount', { n: p.images.length })}</span>
                </div>
                <div className="card-body">
                  <h3>{p.title}</h3>
                  <p className="muted">{p.heading}</p>
                  <div className="card-footer">
                    <button className="btn btn-primary btn-sm" onClick={() => setOfficialView(p)}>
                      <span className="material-icons" style={{ fontSize: '16px' }}>visibility</span>
                      {t('teacherSpace.annualPlans.viewDistribution')}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <h4 style={{ margin: '1.6rem 0 0.8rem' }}>{t('teacherSpace.annualPlans.myPlansTitle')}</h4>
      {plans.length === 0 ? (
        <div className="empty">{t('teacherSpace.annualPlans.empty')}</div>
      ) : (
        <div className="cards-grid">
          {plans.map((p) => (
            <div key={p.id} className="card-item">
              <h4>{p.title}</h4>
              <p className="sub">{p.subject} — {p.level}</p>
              <div className="actions">
                <button className="btn btn-sm" onClick={() => setView(p)}>{t('teacherSpace.annualPlans.view')}</button>
                <button className="btn btn-danger btn-sm" onClick={() => remove(p.id)}>{t('teacherSpace.annualPlans.delete')}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {officialView && (
        <div className="modal-overlay" onClick={() => setOfficialView(null)}>
          <div className="modal plan-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{officialView.title}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setOfficialView(null)}>{t('teacherSpace.annualPlans.close')}</button>
            </div>
            <div className="plan-html" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(officialView.html || '') }} />
          </div>
        </div>
      )}

      {view && (
        <div className="memo-view">
          <div className="panel-head">
            <h4>{view.title}</h4>
            <div className="btn-group">
              <button className="btn" onClick={() => window.print()}>{t('teacherSpace.annualPlans.print')}</button>
              <button className="btn" onClick={() => setView(null)}>{t('teacherSpace.annualPlans.back')}</button>
            </div>
          </div>
          {(content.units || []).map((u, i) => (
            <div key={i} className="stage-item">
              <div className="stage-head">
                <strong>{u.theme}</strong>
                <span className="badge">{u.period}</span>
              </div>
              <ul>
                {(u.lessons || []).map((l, j) => (
                  <li key={j}>{l}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
