import { useState, useEffect, useRef } from 'react';
import { api } from '../../api/client.js';
import StoryExercises from './StoryExercises.jsx';
import AssessmentPaper from '../../components/AssessmentPaper.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { useStudentLevel } from '../../hooks/useStudentLevel.js';

const GRADES = ['year1', 'year2', 'year3', 'year4', 'year5', 'year6'];

function matchGrade(storyGrade, g) {
  if (!storyGrade || !g) return false;
  if (storyGrade === g) return true;
  // تلاميذ السنة الثانية يرون قصص السنة الأولى أيضاً (مستوى تمهيدي مناسب)
  if (g === 'year2' && storyGrade === 'year1') return true;
  return false;
}

function storyText(story) {
  if (Array.isArray(story.text) && story.text.length) return story.text.join(' ');
  if (Array.isArray(story.textArray) && story.textArray.length) return story.textArray.join(' ');
  if (typeof story.text === 'string' && story.text) return story.text;
  return '';
}

export default function StudentStories() {
  const { t } = useI18n();
  const ownLevel = useStudentLevel();
  const [seriesList, setSeriesList] = useState([]);
  const [activeSeries, setActiveSeries] = useState(null);
  const [openStory, setOpenStory] = useState(null);
  const [grade, setGrade] = useState('all');
  const [storyMap, setStoryMap] = useState(null);
  const [storyFull, setStoryFull] = useState(false);
  const [assessAnswers, setAssessAnswers] = useState({});
  const [assessSubmitting, setAssessSubmitting] = useState(false);
  const [assessResult, setAssessResult] = useState(null);

  const handleAssessAnswer = (blockId, answer) => setAssessAnswers((prev) => ({ ...prev, [blockId]: answer }));
  const handleAssessSubmit = async () => {
    if (!openStory) return;
    const kept = Object.fromEntries(Object.entries(assessAnswers).filter(([, v]) => v !== '' && v != null));
    if (!Object.keys(kept).length) { setAssessResult({ success: false, message: 'أجب عن سؤال واحد على الأقل قبل الإرسال' }); return; }
    setAssessSubmitting(true);
    setAssessResult(null);
    try {
      await api.post('/student/lesson/submit', {
        lessonId: openStory.id,
        lessonTitle: openStory.title,
        answers: kept,
        isAssessment: true,
        submittedAt: new Date().toISOString()
      });
      setAssessResult({ success: true, message: 'تم إرسال إجاباتك للمعلّم بنجاح!' });
    } catch (e) {
      setAssessResult({ success: false, message: e.message || 'فشل الإرسال' });
    } finally {
      setAssessSubmitting(false);
    }
  };
  const [loading, setLoading] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const speechRef = useRef(null);

  useEffect(() => {
    api
      .get('/public/stories')
      .then(setSeriesList)
      .catch(() => {})
      .finally(() => setLoading(false));
    api.get('/public/story-map').then(setStoryMap).catch(() => setStoryMap(null));
  }, []);

  useEffect(() => {
    return () => {
      if (speechRef.current) {
        window.speechSynthesis?.cancel();
      }
    };
  }, []);

  const loadSeries = async (id) => {
    try {
      const data = await api.get(`/public/stories/${id}`);
      setActiveSeries(data);
    } catch {
      /* ignore */
    }
  };

  const seriesForGrade = (s) => {
    if (!ownLevel && grade === 'all') return s;
    const g = ownLevel || grade;
    if (!storyMap) return s;
    const mapSeries = storyMap?.series?.find((x) => x.id === s.id);
    if (mapSeries && matchGrade(mapSeries.grade, g)) return s;
    const count = storyMap?.stories?.filter((st) => st.series === s.id && matchGrade(st.grade, g)).length || 0;
    if (count > 0) return { ...s, count };
    return null;
  };

  const visibleSeries = seriesList.map(seriesForGrade).filter(Boolean);

  const storiesForGrade = (stories) => {
    if (!ownLevel && grade === 'all') return stories;
    const g = ownLevel || grade;
    if (!storyMap) return stories;
    const ids = new Set(storyMap?.stories?.filter((st) => st.series === activeSeries.id && matchGrade(st.grade, g)).map((st) => st.id) || []);
    return stories.filter((st) => ids.has(st.id ?? st.storyId));
  };

  const toggleSpeech = (story) => {
    if (!window.speechSynthesis) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const text = storyText(story);
    if (!text) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'ar-TN';
    const voices = window.speechSynthesis.getVoices();
    const arVoice = voices.find((v) => v.lang && v.lang.startsWith('ar'));
    if (arVoice) utter.voice = arVoice;
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    speechRef.current = utter;
    setSpeaking(true);
    window.speechSynthesis.speak(utter);
  };

  useEffect(() => {
    setAssessAnswers({});
    setAssessResult(null);
  }, [openStory?.id]);

  const current = activeSeries || (seriesList.length ? null : null);

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{t('studentSpace.stories.title')}</h3>
      </div>

      {!ownLevel && (
        <div className="flash-grades" style={{ marginBottom: '0.8rem' }}>
          <button className={`chip ${grade === 'all' ? 'active' : ''}`} onClick={() => setGrade('all')}>
            {t('studentSpace.stories.allGrades')}
          </button>
          {GRADES.map((g) => (
            <button key={g} className={`chip ${grade === g ? 'active' : ''}`} onClick={() => setGrade(g)}>
              {t(`studentSpace.flashcards.grade.${g}`)}
            </button>
          ))}
        </div>
      )}

      <div className="subject-tabs">
        {visibleSeries.map((s) => (
          <button
            key={s.id}
            className={`subject-tab ${activeSeries?.id === s.id ? 'active' : ''}`}
            style={activeSeries?.id === s.id ? { background: 'linear-gradient(135deg, #7b3fa0, #a86bc8)', color: '#fff' } : {}}
            onClick={() => loadSeries(s.id)}
          >
            <span className="material-icons">auto_stories</span>
            {s.title}
            <span className="subject-count">{t('studentSpace.stories.storiesCount', { n: s.count })}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-wrap"><span className="spinner" /></div>
      ) : !current ? (
        <div className="empty">
          {grade === 'all' ? t('studentSpace.stories.pickSeries') : t('studentSpace.stories.noStoriesForGrade')}
        </div>
      ) : (
        <>
          <p className="muted" style={{ marginBottom: '1.2rem' }}>{current.title} — {t('studentSpace.stories.storiesCount', { n: storiesForGrade(current.stories).length })}</p>
          <div className="card-grid">
            {storiesForGrade(current.stories).map((story) => {
              const img = story.image || story.imageUrl;
              return (
                <div key={story.id} className="card story-card">
                  {img ? (
                    <div className="story-cover">
                      <img src={img} alt={story.title} loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    </div>
                  ) : (
                    <div className="lesson-head" style={{ background: 'linear-gradient(135deg, #7b3fa0, #a86bc8)' }}>
                      <span className="material-icons" style={{ fontSize: '2.4rem', color: '#fff' }}>auto_stories</span>
                    </div>
                  )}
                  <div className="card-body">
                    <h3>{story.title || story.storyTitle}</h3>
                    <div className="card-footer">
                      <button className="btn btn-primary btn-sm" onClick={() => setOpenStory(story)}>
                        <span className="material-icons" style={{ fontSize: '16px' }}>menu_book</span>
                        {t('studentSpace.stories.readStory')}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {openStory && (
        <div className="modal-overlay" onClick={() => { setOpenStory(null); setStoryFull(false); window.speechSynthesis?.cancel(); setSpeaking(false); }}>
          <div className={`modal story-modal${storyFull ? ' full' : ''}`} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{openStory.title || openStory.storyTitle}</h3>
              <div className="row">
                {storyText(openStory) && (
                  <button className="btn btn-outline btn-sm" onClick={() => toggleSpeech(openStory)}>
                    <span className="material-icons">{speaking ? 'stop' : 'volume_up'}</span>
                    {speaking ? t('studentSpace.stories.stopListen') : t('studentSpace.stories.listen')}
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setStoryFull((v) => !v)}
                  title={storyFull ? 'تصغير' : 'ملء الشاشة'}
                >
                  <span className="material-icons" style={{ fontSize: 18 }}>{storyFull ? 'fullscreen_exit' : 'fullscreen'}</span>
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => { setOpenStory(null); setStoryFull(false); window.speechSynthesis?.cancel(); setSpeaking(false); }}>{t('common.close')}</button>
              </div>
            </div>
            <div className="story-content">
              {openStory.assessment ? (
                <AssessmentPaper
                  lesson={{ id: openStory.id, title: openStory.title, subject: openStory.subject || 'القراءة', period: openStory.period || 1, isAssessment: true, blocks: openStory.studentBlocks || [] }}
                  answers={assessAnswers}
                  onAnswer={handleAssessAnswer}
                  submitting={assessSubmitting}
                  submitResult={assessResult}
                  onSubmit={handleAssessSubmit}
                />
              ) : (
              <>
              {(openStory.image || openStory.imageUrl) && (
                <img
                  src={openStory.image || openStory.imageUrl}
                  alt={openStory.title}
                  className="story-hero"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              )}
              {(openStory.text || []).length > 0 && (
                <div className="story-paragraphs">
                  {(openStory.text || []).map((line, i) => (
                    <p key={i} className="story-line">{line}</p>
                  ))}
                </div>
              )}
              {openStory.textArray && (
                <div className="story-paragraphs">
                  {(Array.isArray(openStory.textArray) ? openStory.textArray : []).map((line, i) => (
                    <p key={i} className="story-line">{line}</p>
                  ))}
                </div>
              )}
              {!Array.isArray(openStory.text) && openStory.text && (
                <div className="story-paragraphs">
                  <p className="story-line">{openStory.text}</p>
                </div>
              )}
              {openStory.key_sentence && <p className="story-key">{t('studentSpace.stories.keySentence', { text: openStory.key_sentence })}</p>}
              {openStory.keySentence && <p className="story-key">{t('studentSpace.stories.keySentence', { text: openStory.keySentence })}</p>}
              {openStory.letters && <p className="story-letters">{t('studentSpace.stories.letters', { list: openStory.letters.join('، ') })}</p>}
              <StoryExercises
                exercises={openStory.exercises}
                activities={openStory.activities}
                questions={openStory.questions}
                matchPairs={openStory.matchPairs}
              />
              {openStory.moral && <p className="story-key">{t('studentSpace.stories.moral', { text: openStory.moral })}</p>}
              </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}