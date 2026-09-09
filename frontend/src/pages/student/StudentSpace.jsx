import { useState, useEffect, useCallback } from 'react';
import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { api } from '../../api/client.js';
import StudentQuizzes from './StudentQuizzes.jsx';
import StudentOfficialExams from './StudentOfficialExams.jsx';
import StudentBooks from './StudentBooks.jsx';
import StudentVideos from './StudentVideos.jsx';
import StudentAdaptive from './StudentAdaptive.jsx';
import StudentLearningPlan from './StudentLearningPlan.jsx';
import StudentStories from './StudentStories.jsx';
import StudentTwin from './StudentTwin.jsx';
import AskRefeeqi from './AskRefeeqi.jsx';
import StudentSchedule from './StudentSchedule.jsx';
import StudentProfile from './StudentProfile.jsx';
import StudentSubjects from './StudentSubjects.jsx';
import PlayZone from './PlayZone.jsx';
import PaperExamScan from './PaperExamScan.jsx';
import StudentAssignments from './StudentAssignments.jsx';
import StudentLiveSessions from './StudentLiveSessions.jsx';
import StudentDailyRoutine from './StudentDailyRoutine.jsx';
import StudentFlashcards from './StudentFlashcards.jsx';
import SchoolCalendar from '../../components/SchoolCalendar.jsx';

const TABS = [
  { to: '', end: true, icon: 'home', key: 'home' },
  { to: 'routine', icon: 'today', key: 'routine' },
  { to: 'flashcards', icon: 'style', key: 'flashcards' },
  { to: 'subjects', icon: 'menu_book', key: 'subjects' },
  { to: 'quizzes', icon: 'quiz', key: 'quizzes' },
  { to: 'official-exams', icon: 'description', key: 'officialExams' },
  { to: 'assignments', icon: 'assignment', key: 'assignments' },
  { to: 'live', icon: 'live_tv', key: 'live' },
  { to: 'paper-exam', icon: 'document_scanner', key: 'paperExam' },
  { to: 'play', icon: 'sports_esports', key: 'play' },
  { to: 'books', icon: 'auto_stories', key: 'books' },
  { to: 'adaptive', icon: 'psychology', key: 'adaptive' },
  { to: 'plan', icon: 'route', key: 'plan' },
  { to: 'videos', icon: 'smart_display', key: 'videos' },
  { to: 'stories', icon: 'library_books', key: 'stories' },
  { to: 'calendar', icon: 'calendar_month', key: 'calendar' },
  { to: 'refeeqi', icon: 'smart_toy', key: 'refeeqi' },
  { to: 'twin', icon: 'insights', key: 'twin' },
  { to: 'schedule', icon: 'calendar_view_week', key: 'schedule' }
];

export default function StudentSpace() {
  const { user } = useAuth();
  const { t } = useI18n();
  const location = useLocation();
  const [profile, setProfile] = useState(null);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('rafiqi-student-sidebar') === 'collapsed');
  const [mobileOpen, setMobileOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get('/student/profile');
      setProfile(data);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    localStorage.setItem('rafiqi-student-sidebar', collapsed ? 'collapsed' : 'expanded');
  }, [collapsed]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  if (!user || user.role !== 'STUDENT') {
    return <Navigate to="/dashboard" replace />;
  }

  const aside = (
    <aside className={`student-sidebar ${collapsed ? 'is-collapsed' : ''} ${mobileOpen ? 'is-open' : ''}`}>
      <div className="student-sidebar-head">
        <span className="student-sidebar-title">{t('studentSpace.sidebarTitle')}</span>
        <button
          type="button"
          className="sidebar-toggle"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? t('studentSpace.expand') : t('studentSpace.collapse')}
          title={collapsed ? t('studentSpace.expand') : t('studentSpace.collapse')}
        >
          <span className="material-icons">{collapsed ? 'chevron_left' : 'chevron_right'}</span>
        </button>
      </div>
      <nav className="student-sidebar-nav">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={`/student-space/${tab.to}`}
            end={tab.end}
            className={({ isActive }) => `student-nav-item ${isActive ? 'active' : ''}`}
            title={t(`studentSpace.tabs.${tab.key}`)}
          >
            <span className="nav-dot" aria-hidden="true" />
            <span className="material-icons nav-ico">{tab.icon}</span>
            <span className="nav-label">{t(`studentSpace.tabs.${tab.key}`)}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );

  return (
    <div className="student-space student-space--v2">
      <div className="container">
        <StudentProfile profile={profile} onMenu={() => setMobileOpen(true)} />

        <div className="student-layout">
          {aside}
          <div className="tab-content student-main">
            <Routes>
              <Route index element={<StudentTwin />} />
              <Route path="routine" element={<StudentDailyRoutine />} />
              <Route path="flashcards" element={<StudentFlashcards />} />
              <Route path="subjects" element={<StudentSubjects />} />
              <Route path="quizzes" element={<StudentQuizzes onChanged={load} />} />
              <Route path="official-exams" element={<StudentOfficialExams onChanged={load} />} />
              <Route path="assignments" element={<StudentAssignments onChanged={load} />} />
              <Route path="live" element={<StudentLiveSessions />} />
              <Route path="paper-exam" element={<PaperExamScan />} />
              <Route path="play" element={<PlayZone />} />
              <Route path="books" element={<StudentBooks />} />
              <Route path="adaptive" element={<StudentAdaptive />} />
              <Route path="plan" element={<StudentLearningPlan />} />
              <Route path="videos" element={<StudentVideos />} />
              <Route path="stories" element={<StudentStories />} />
              <Route path="calendar" element={<SchoolCalendar />} />
              <Route path="refeeqi" element={<AskRefeeqi />} />
              <Route path="twin" element={<StudentTwin />} />
              <Route path="schedule" element={<StudentSchedule />} />
            </Routes>
          </div>
        </div>
      </div>

      {mobileOpen && (
        <>
          <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} />
          <div className="student-sidebar-drawer">{aside}</div>
        </>
      )}
    </div>
  );
}
