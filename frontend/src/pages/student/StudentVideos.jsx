import { useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import VideoCard from '../../components/VideoCard.jsx';
import VideoPlayer from '../../components/VideoPlayer.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { useStudentLevel } from '../../hooks/useStudentLevel.js';

const SUBJECT_CODES = ['math', 'anisi', 'science'];
const SUBJECT_META = {
  math: { icon: 'calculate', bg: 'linear-gradient(135deg, #233863, #2f4a7d)' },
  anisi: { icon: 'menu_book', bg: 'linear-gradient(135deg, #f4ab2c, #E8A317)' },
  science: { icon: 'science', bg: 'linear-gradient(135deg, #0e6b4f, #17a076)' }
};

export default function StudentVideos() {
  const { t } = useI18n();
  const ownLevel = useStudentLevel();
  const [videos, setVideos] = useState([]);
  const [grades, setGrades] = useState([]);
  const [activeSubject, setActiveSubject] = useState('all');
  const [activeGrade, setActiveGrade] = useState('all');
  const [playVideo, setPlayVideo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/public/curriculum/books')
      .then((books) => {
        const g = ownLevel
          ? [ownLevel]
          : [...new Set((Array.isArray(books) ? books : []).map((b) => b.gradeId))].sort(
              (a, b) => Number(a.replace(/\D/g, '')) - Number(b.replace(/\D/g, ''))
            );
        setGrades(g);
      })
      .catch(() => {});
  }, [ownLevel]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const params = new URLSearchParams();
    if (activeSubject !== 'all') params.set('subjectId', activeSubject);
    if (ownLevel) params.set('gradeId', ownLevel);
    else if (activeGrade !== 'all') params.set('gradeId', activeGrade);
    const qs = params.toString();
    api
      .get(`/public/videos${qs ? `?${qs}` : ''}`)
      .then((data) => {
        if (alive) setVideos(Array.isArray(data) ? data : []);
      })
      .catch(() => { if (alive) setVideos([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [activeSubject, activeGrade, ownLevel]);

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{t('studentSpace.videos.title')}</h3>
      </div>

      <div className="subject-tabs">
        <button
          className={`subject-tab ${activeSubject === 'all' ? 'active' : ''}`}
          style={activeSubject === 'all' ? { background: 'var(--primary)', color: '#fff' } : {}}
          onClick={() => setActiveSubject('all')}
        >
          <span className="material-icons">play_circle</span>
          {t('studentSpace.videos.allSubjects')}
        </button>
        {SUBJECT_CODES.map((code) => (
          <button
            key={code}
            className={`subject-tab ${activeSubject === code ? 'active' : ''}`}
            style={activeSubject === code ? { background: SUBJECT_META[code].bg, color: '#fff' } : {}}
            onClick={() => setActiveSubject(code)}
          >
            <span className="material-icons">{SUBJECT_META[code].icon}</span>
            {t(`studentSpace.books.subjects.${code}`)}
          </button>
        ))}
      </div>

      {!ownLevel && (
        <div className="subject-tabs">
          <button
            className={`subject-tab ${activeGrade === 'all' ? 'active' : ''}`}
            style={activeGrade === 'all' ? { background: 'var(--accent)', color: '#fff' } : {}}
            onClick={() => setActiveGrade('all')}
          >
            {t('studentSpace.videos.allLevels')}
          </button>
          {grades.map((g) => (
            <button
              key={g}
              className={`subject-tab ${activeGrade === g ? 'active' : ''}`}
              style={activeGrade === g ? { background: 'var(--accent)', color: '#fff' } : {}}
              onClick={() => setActiveGrade(g)}
            >
              {g}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="loading-wrap"><span className="spinner" /></div>
      ) : videos.length === 0 ? (
        <div className="empty">
          {t('studentSpace.videos.empty')}
        </div>
      ) : (
        <div className="card-grid">
          {videos.map((v) => (
            <VideoCard key={v.id} video={v} onPlay={() => setPlayVideo(v)} />
          ))}
        </div>
      )}

      {playVideo && (
        <div className="modal-overlay" onClick={() => setPlayVideo(null)}>
          <div className="modal video-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3>{playVideo.title}</h3>
                {playVideo.source && <p className="viewer-sub">{playVideo.source}</p>}
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setPlayVideo(null)}>{t('common.close')}</button>
            </div>
            <div className="video-modal-body">
              <VideoPlayer video={playVideo} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
