import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';

const TAB_IDS = ['plan', 'quiz', 'summary', 'slides', 'story'];
const TAB_ICONS = { plan: 'edit_calendar', quiz: 'quiz', summary: 'summarize', slides: 'slideshow', story: 'auto_stories' };

export default function TeacherAI() {
  const { t } = useI18n();
  const defaultSubject = t('teacherSpace.teacherAI.defaultSubject');
  const defaultLevel = t('teacherSpace.teacherAI.defaultLevel');

  const [tab, setTab] = useState('plan');
  const [configured, setConfigured] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const [planForm, setPlanForm] = useState({ subject: defaultSubject, level: defaultLevel, lessonTitle: '', duration: 45 });
  const [quizForm, setQuizForm] = useState({ subject: defaultSubject, level: defaultLevel, lessonTitle: '', count: 5 });
  const [summaryForm, setSummaryForm] = useState({ subject: defaultSubject, level: defaultLevel, lessonTitle: '', maxWords: 150 });
  const [slidesForm, setSlidesForm] = useState({ subject: defaultSubject, level: defaultLevel, lessonTitle: '', slideCount: 8 });
  const [storyForm, setStoryForm] = useState({ level: defaultLevel, theme: '' });

  const [output, setOutput] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const load = useCallback(() => {
    api
      .get('/ai/key')
      .then((d) => setConfigured(d.configured))
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveKey = async (e) => {
    e.preventDefault();
    try {
      await api.post('/ai/key', { apiKey });
      setApiKey('');
      setConfigured(true);
    } catch (err) {
      setError(err.message);
    }
  };

  const removeKey = async () => {
    await api.del('/ai/key');
    setConfigured(false);
  };

  const run = async (path, payload) => {
    setError('');
    setSaveMsg('');
    setGenerating(true);
    try {
      const res = await api.post(path, payload);
      return res;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setGenerating(false);
    }
  };

  const generatePlan = async (e) => {
    e.preventDefault();
    const res = await run('/ai/generate-lesson-plan', planForm);
    if (res) setOutput({ type: 'plan', data: res.lessonPlan, form: planForm });
  };

  const generateQuiz = async (e) => {
    e.preventDefault();
    const res = await run('/ai/generate-quiz', quizForm);
    if (res) setOutput({ type: 'quiz', data: res.questions, form: quizForm });
  };

  const generateSummary = async (e) => {
    e.preventDefault();
    const res = await run('/ai/generate-summary', summaryForm);
    if (res) setOutput({ type: 'summary', data: res.summary, form: summaryForm });
  };

  const generateSlides = async (e) => {
    e.preventDefault();
    const res = await run('/ai/generate-presentation', slidesForm);
    if (res) setOutput({ type: 'slides', data: res.slides, form: slidesForm });
  };

  const generateStory = async (e) => {
    e.preventDefault();
    const res = await run('/ai/generate-story', storyForm);
    if (res) setOutput({ type: 'story', data: res.story, form: storyForm });
  };

  const saveAsResource = async () => {
    if (!output) return;
    setSaving(true);
    setSaveMsg('');
    try {
      const form = output.form || {};
      const kind = output.type === 'plan' ? 'LESSON_PLAN' : output.type === 'slides' ? 'PRESENTATION' : output.type === 'quiz' ? 'WORKSHEET' : 'HOMEWORK';
      const created = await api.post('/teacher/resources', {
        kind,
        subject: form.subject || 'MATH',
        level: form.level || defaultLevel,
        lessonTitle: form.lessonTitle || t('teacherSpace.teacherAI.fields.lessonTitle')
      });
      const content =
        output.type === 'plan'
          ? { title: created.title, ...output.data }
          : output.type === 'slides'
            ? { title: created.title, slides: output.data }
            : output.type === 'quiz'
              ? { title: created.title, exercises: output.data }
              : { title: created.title, story: output.data };
      await api.put(`/teacher/resources/${created.id}`, { content });
      setSaveMsg(t('teacherSpace.teacherAI.savedMsg'));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const inputGroup = (form, setForm, fields) => (
    fields.map((f) => (
      <div className="form-group" key={f.key}>
        <label>{t(`teacherSpace.teacherAI.fields.${f.key}`)}</label>
        <input
          type={f.type || 'text'}
          value={form[f.key] ?? ''}
          min={f.min}
          max={f.max}
          onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
        />
      </div>
    ))
  );

  const forms = {
    plan: {
      title: t('teacherSpace.teacherAI.forms.plan.title'),
      desc: t('teacherSpace.teacherAI.forms.plan.desc'),
      button: t('teacherSpace.teacherAI.forms.plan.button'),
      fields: [
        { key: 'subject' },
        { key: 'level' },
        { key: 'lessonTitle', required: true },
        { key: 'duration', type: 'number', min: 10, max: 180 }
      ],
      submit: generatePlan
    },
    quiz: {
      title: t('teacherSpace.teacherAI.forms.quiz.title'),
      desc: t('teacherSpace.teacherAI.forms.quiz.desc'),
      button: t('teacherSpace.teacherAI.forms.quiz.button'),
      fields: [
        { key: 'subject' },
        { key: 'level' },
        { key: 'lessonTitle', required: true },
        { key: 'count', type: 'number', min: 1, max: 30 }
      ],
      submit: generateQuiz
    },
    summary: {
      title: t('teacherSpace.teacherAI.forms.summary.title'),
      desc: t('teacherSpace.teacherAI.forms.summary.desc'),
      button: t('teacherSpace.teacherAI.forms.summary.button'),
      fields: [
        { key: 'subject' },
        { key: 'level' },
        { key: 'lessonTitle', required: true },
        { key: 'maxWords', type: 'number', min: 30, max: 500 }
      ],
      submit: generateSummary
    },
    slides: {
      title: t('teacherSpace.teacherAI.forms.slides.title'),
      desc: t('teacherSpace.teacherAI.forms.slides.desc'),
      button: t('teacherSpace.teacherAI.forms.slides.button'),
      fields: [
        { key: 'subject' },
        { key: 'level' },
        { key: 'lessonTitle', required: true },
        { key: 'slideCount', type: 'number', min: 3, max: 25 }
      ],
      submit: generateSlides
    },
    story: {
      title: t('teacherSpace.teacherAI.forms.story.title'),
      desc: t('teacherSpace.teacherAI.forms.story.desc'),
      button: t('teacherSpace.teacherAI.forms.story.button'),
      fields: [
        { key: 'level' },
        { key: 'theme', required: true }
      ],
      submit: generateStory
    }
  };

  const current = forms[tab];

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{t('teacherSpace.teacherAI.title')}</h3>
        <p className="muted">{t('teacherSpace.teacherAI.subtitle')}</p>
      </div>

      <div className="card-item ai-key-card">
        <h4>{configured ? t('teacherSpace.teacherAI.keyConfigured') : t('teacherSpace.teacherAI.keyNotConfigured')}</h4>
        {configured ? (
          <p className="muted">{t('teacherSpace.teacherAI.keyConfiguredNote')}</p>
        ) : (
          <p className="muted">{t('teacherSpace.teacherAI.keyNotConfiguredNote')}</p>
        )}
        {!configured ? (
          <form className="form-row" onSubmit={saveKey}>
            <div className="form-group grow">
              <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={t('teacherSpace.teacherAI.keyPlaceholder')} required />
            </div>
            <button className="btn btn-primary" type="submit">{t('teacherSpace.teacherAI.saveKey')}</button>
          </form>
        ) : (
          <button className="btn btn-danger" onClick={removeKey}>{t('teacherSpace.teacherAI.removeKey')}</button>
        )}
      </div>

      {error && <div className="form-error">{error}</div>}

      <div className="ai-tabs">
        {TAB_IDS.map((id) => (
          <button
            key={id}
            type="button"
            className={`ai-tab ${tab === id ? 'active' : ''}`}
            onClick={() => setTab(id)}
          >
            <span className="material-icons">{TAB_ICONS[id]}</span>
            {t(`teacherSpace.teacherAI.tabs.${id}`)}
          </button>
        ))}
      </div>

      <div className="card-item">
        <h4>{current.title}</h4>
        <p className="muted">{current.desc}</p>
        <form onSubmit={current.submit}>
          <div className="form-row">
            {inputGroup(current.submit === generateStory ? storyForm : tab === 'plan' ? planForm : tab === 'quiz' ? quizForm : tab === 'summary' ? summaryForm : slidesForm, tab === 'plan' ? setPlanForm : tab === 'quiz' ? setQuizForm : tab === 'summary' ? setSummaryForm : tab === 'slides' ? setSlidesForm : setStoryForm, current.fields)}
          </div>
          <button className="btn btn-primary" disabled={generating}>
            {generating ? t('teacherSpace.teacherAI.generating') : current.button}
          </button>
        </form>
      </div>

      {output && (
        <div className="memo-view ai-output">
          <div className="panel-head">
            <h4>{t('teacherSpace.teacherAI.outputTitle')}</h4>
            <div className="form-row" style={{ margin: 0 }}>
              <button className="btn" onClick={() => setOutput(null)}>{t('teacherSpace.teacherAI.close')}</button>
              {output.type !== 'story' && (
                <button className="btn btn-primary" onClick={saveAsResource} disabled={saving}>
                  {saving ? t('teacherSpace.teacherAI.saving') : t('teacherSpace.teacherAI.saveAsResource')}
                </button>
              )}
            </div>
          </div>
          {saveMsg && <p className="good-text">{saveMsg}</p>}

          {output.type === 'plan' && (
            <div className="stage-item">
              {output.data?.memoTitle && <p><strong>{output.data.memoTitle}</strong>{output.data?.timingMinutes ? ` — ${t('teacherSpace.teacherAI.memoTiming', { n: output.data.timingMinutes })}` : ''}</p>}
              {output.data?.competency && <p><strong>{t('teacherSpace.teacherAI.memoCompetency')}</strong> {output.data.competency}</p>}
              {output.data?.objective && <p><strong>{t('teacherSpace.teacherAI.memoObjective')}</strong> {output.data.objective}</p>}
              {output.data?.content && <p><strong>{t('teacherSpace.teacherAI.memoContent')}</strong> {output.data.content}</p>}
              {output.data?.lessonGoal && <p><strong>{t('teacherSpace.teacherAI.memoLessonGoal')}</strong> {output.data.lessonGoal}</p>}
              {Array.isArray(output.data?.stages) && output.data.stages.length > 0 && (
                <div className="table-wrap">
                  <p><strong>{t('teacherSpace.teacherAI.memoStages')}</strong></p>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{t('teacherSpace.teacherAI.memoStage')}</th>
                        <th>{t('teacherSpace.teacherAI.memoTeacher')}</th>
                        <th>{t('teacherSpace.teacherAI.memoLearner')}</th>
                        <th>{t('teacherSpace.teacherAI.memoTools')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {output.data.stages.map((s, i) => (
                        <tr key={i}>
                          <th>{s.name}</th>
                          <td style={{ whiteSpace: 'pre-line' }}>{s.teacherActivity}</td>
                          <td style={{ whiteSpace: 'pre-line' }}>{s.learnerActivity}</td>
                          <td>{s.tools}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {!Array.isArray(output.data?.stages) && <pre>{JSON.stringify(output.data, null, 2)}</pre>}
            </div>
          )}

          {output.type === 'quiz' && (
            Array.isArray(output.data) ? (
              output.data.map((q, i) => (
                <div key={i} className="stage-item">
                  <p><strong>{i + 1}. {q.prompt}</strong></p>
                  {q.options && <p className="muted">{q.options.join(' — ')}</p>}
                  {q.correctAnswer !== undefined && q.correctAnswer !== '' && (
                    <p className="good-text">{t('teacherSpace.teacherAI.answer', { value: q.correctAnswer })}</p>
                  )}
                  {q.correctOption !== undefined && q.correctOption !== '' && (
                    <p className="good-text">{t('teacherSpace.teacherAI.answer', { value: q.options[Number(q.correctOption)] })}</p>
                  )}
                </div>
              ))
            ) : (
              <pre>{JSON.stringify(output.data, null, 2)}</pre>
            )
          )}

          {output.type === 'summary' && (
            <p style={{ lineHeight: 1.9 }}>{output.data}</p>
          )}

          {output.type === 'slides' && (
            Array.isArray(output.data) ? (
              output.data.map((s, i) => (
                <div key={i} className="stage-item">
                  <p><strong>{i + 1}. {s.title}</strong></p>
                  <p className="muted">{s.body}</p>
                </div>
              ))
            ) : (
              <pre>{JSON.stringify(output.data, null, 2)}</pre>
            )
          )}

          {output.type === 'story' && (
            <p style={{ lineHeight: 1.9 }}>{output.data}</p>
          )}
        </div>
      )}
    </div>
  );
}
